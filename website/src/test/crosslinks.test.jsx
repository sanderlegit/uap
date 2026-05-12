import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ExplorationTrailProvider } from '../hooks/useExplorationTrail'

// --- Fixture data ---

const DOC_FIXTURE = {
  id: 5,
  title: 'UFO Sighting Over Washington',
  agency: 'Department of War',
  incident_date_parsed: '1952-07-19',
  incident_location: 'Washington, D.C.',
  total_pages: 3,
  text_length: 1200,
  latitude: 38.9,
  longitude: -77.0,
  decade: '1950s',
  full_text: 'Radar contact established. Object showed luminosity change over the capital.',
  extraction_method: 'OCR',
  ocr_applied: true,
  filename: 'doc_5.pdf',
  sensors: [],
  behaviors: [],
  shapes: [],
  witnesses: [],
  entities: [{ entity_type: 'organization', entity_value: 'USAF' }],
  has_redaction: 0,
  cross_refs: [],
  redaction: [],
}

const DOC_NO_COORDS = {
  id: 103,
  title: 'Apollo 11 Technical Crew Debriefing',
  agency: 'NASA',
  incident_date_parsed: '1969-07-31',
  incident_location: '',
  total_pages: 11,
  text_length: 10995,
  latitude: null,
  longitude: null,
  decade: '1960s',
  full_text: 'Apollo 11 crew debriefing transcript.',
  extraction_method: 'OCR',
  ocr_applied: true,
  filename: 'doc_103.pdf',
  sensors: [],
  behaviors: [],
  shapes: [],
  witnesses: [],
  entities: [],
  has_redaction: 0,
  cross_refs: [],
  redaction: [],
}

const DOCS_FIXTURE = [
  { id: 4, title: 'Previous Doc', agency: 'FBI', incident_date_parsed: '1950-01-01', decade: '1950s', total_pages: 1, text_length: 500, latitude: 35, longitude: -80 },
  { ...DOC_FIXTURE },
  { id: 6, title: 'Next Doc', agency: 'NASA', incident_date_parsed: '1960-06-01', decade: '1960s', total_pages: 2, text_length: 800 },
  { ...DOC_NO_COORDS },
]

const ENTITY_FIXTURE = {
  name: 'USAF',
  type: 'organization',
  doc_count: 2,
  doc_ids: [5, 6],
  agencies: ['Department of War'],
  decades: ['1950s'],
}

const VOCAB_FIXTURE = {
  meta: { total_pages: 1000 },
  loading_scale: {
    '1': { label: 'Neutral', color: '#22c55e', description: 'Standard English' },
    '2': { label: 'Mild', color: '#eab308', description: 'Mild assumption' },
    '3': { label: 'Loaded', color: '#f97316', description: 'Loaded framing' },
    '4': { label: 'Shibboleth', color: '#ef4444', description: 'Tribal marker' },
  },
  categories: [{ id: 'descriptive', label: 'Descriptive', color: '#60a5fa', description: 'test' }],
  timeline: [],
  terms: [
    { term: 'luminosity', loading: 3, category: 'descriptive', definition: 'Brightness of an object', era: '1950s', source: 'original', total_count: 12, doc_count: 3, doc_ids: [5, 6], doc_counts: { 5: 4, 6: 2 }, worldview: 'loaded', related_terms: ['brightness'] },
    { term: 'craft', loading: 2, category: 'descriptive', definition: 'Catch-all for unidentified object', era: '1940s', source: 'both', total_count: 30, doc_count: 8, doc_ids: [5], doc_counts: { 5: 10 }, worldview: 'mild_assumption', related_terms: ['object'] },
  ],
}

const PULSE_FIXTURE = {
  generated_at: '2026-05-10T12:00:00Z',
  stats: { total_items: 50, analyzed_items: 30, unanalyzed_items: 20, platforms: { rss: 20, google_news: 15, reddit: 15 } },
  items: [
    { id: 1, platform: 'rss', title: 'UAP hearing update', published_at: '2026-05-09', analyzed: true, relevance: 0.8, content_quality: 'full_text', summary: 'Congress held a hearing.', entities: [{ name: 'Pentagon', type: 'organization' }], theories: [], topics: ['disclosure'], corpus_connections: [] },
  ],
  daily_volume: [],
  trending_topics: [{ topic: 'congressional hearing', sparkline: [1, 2, 3], count: 5 }],
  entity_bridge: [{ name: 'Pentagon', type: 'organization', pulse_mentions: 3, corpus_doc_ids: [5] }],
  entity_index: [],
  source_stats: [],
}

const CASES_FIXTURE = {
  overview: 'Test cases',
  last_updated: '2026-05',
  categories: {
    military_encounter: { label: 'Military', icon: '🎖' },
    mass_sighting: { label: 'Mass Sighting', icon: '👁' },
  },
  cases: [
    { id: 'washington_dc_1952', name: 'Washington D.C. 1952', category: 'mass_sighting', year: 1952, location: 'Washington, D.C.', summary: 'Radar/visual sightings over the capital.', detail: 'Extended detail.', validity: 'Multiple radar confirmations.', evidence_types: ['radar', 'visual'], key_figures: ['Ruppelt'], sources: [], },
    { id: 'foo_fighters_1944', name: 'Foo Fighters', category: 'military_encounter', year: 1944, location: 'Europe', summary: 'WWII pilots reported luminous spheres.', detail: 'Extended detail.', validity: 'Multiple independent reports.', evidence_types: ['visual'], key_figures: [], sources: [], },
  ],
}

const THEORIES_FIXTURE = {
  overview: 'Test theories',
  last_updated: '2026-05',
  theories: [
    { id: 'extraterrestrial', name: 'Extraterrestrial', short: 'Alien visitors', description: 'Full description.', icon: '👽', color: '#22c55e', popularity: 65, scientific_support: 20, key_proponents: ['Hynek'], evidence: ['Radar'], strengths: ['Multi-sensor'], weaknesses: ['No artifacts'], sources: [] },
    { id: 'advanced_human_tech', name: 'Advanced Human Tech', short: 'Secret programs', description: 'Full description.', icon: '🔬', color: '#3b82f6', popularity: 40, scientific_support: 50, key_proponents: ['Klass'], evidence: ['Historical programs'], strengths: ['Precedent'], weaknesses: ['Capability gap'], sources: [] },
  ],
  key_researchers: [],
  community_sources: {},
}

// --- Mocks ---

vi.mock('../hooks/useData', () => ({
  useDocuments: () => DOCS_FIXTURE,
  useDocument: (id) => DOCS_FIXTURE.find(d => d.id === id) || null,
  useGraph: () => ({ edges: [] }),
  useManifest: () => ({}),
  useResearch: () => ({ correlations: [] }),
  useSearch: () => ({ ready: true, search: (q) => DOCS_FIXTURE.filter(d => d.title.toLowerCase().includes(q.toLowerCase())) }),
  useEntities: () => [ENTITY_FIXTURE],
  useVocabulary: () => VOCAB_FIXTURE,
  useDocVocabScores: () => ({ '5': { score: 42, loaded_term_count: 2, total_term_count: 14, top_terms: [{ term: 'luminosity', count: 4 }, { term: 'craft', count: 10 }] } }),
  usePulse: () => PULSE_FIXTURE,
  agencyClass: () => 'agency-dow',
  agencyColor: () => '#3b82f6',
  formatDate: (d) => d || 'Unknown',
  thumbUrl: (id) => `/data/thumbnails/${id}_thumb.jpg`,
  microThumbUrl: (id) => `/data/thumbnails/${id}_micro.webp`,
  coverUrl: (id) => `/data/thumbnails/${id}_cover.jpg`,
  pageImageUrl: (id, p) => `/data/pages/${id}_p${p}.jpg`,
}))

vi.mock('../hooks/useExplorationTrail', () => ({
  ExplorationTrailProvider: ({ children }) => children,
  useExplorationTrail: () => ({ trail: [], addToTrail: vi.fn(), clearTrail: vi.fn() }),
}))

vi.mock('../components/DocThumbnail', () => ({
  default: ({ docId }) => <div data-testid={`thumb-${docId}`} />,
}))

vi.mock('../components/VocabBadge', () => ({
  default: () => null,
}))

vi.mock('../components/InfoTooltip', () => ({
  default: () => null,
}))

vi.mock('../components/LegacyProgramChart', () => ({
  default: () => <div data-testid="legacy-chart" />,
}))

// Helper to render a component at a specific route
function renderAtRoute(ui, { route = '/', state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: route.split('?')[0], search: route.includes('?') ? '?' + route.split('?')[1] : '', state }]}>
      <Routes>
        {ui}
      </Routes>
    </MemoryRouter>
  )
}

// Capture location for assertion
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location" data-pathname={location.pathname} data-search={location.search} data-state={JSON.stringify(location.state)} />
}

// Restore the default fetch mock after tests that override it
afterEach(() => {
  vi.mocked(globalThis.fetch).mockImplementation((url) => {
    if (typeof url === 'string' && url.includes('legacy_web')) {
      return Promise.resolve({ json: () => Promise.resolve({ nodes: [], edges: [] }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({}) })
  })
})

// ============================================================
// Tests
// ============================================================

describe('Search -> Document cross-linking', () => {
  it('search result links include ?search= param and fromSearch state', async () => {
    const Search = (await import('../pages/Search')).default

    renderAtRoute(
      <>
        <Route path="/search" element={<Search />} />
        <Route path="/documents/:id" element={<LocationDisplay />} />
      </>,
      { route: '/search?q=Washington' }
    )

    const link = await screen.findByText('UFO Sighting Over Washington')
    expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('/documents/5'))
    expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('search=Washington'))
  })
})

describe('Entities -> Document cross-linking', () => {
  it('entity doc links include ?search= param with entity name', async () => {
    const user = userEvent.setup()
    const Entities = (await import('../pages/Entities')).default

    renderAtRoute(
      <>
        <Route path="/entities" element={<Entities />} />
        <Route path="/documents/:id" element={<LocationDisplay />} />
      </>,
      { route: '/entities' }
    )

    const entityCard = screen.getByText('USAF')
    await user.click(entityCard)

    const docLink = await screen.findByText('UFO Sighting Over Washington')
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('/documents/5'))
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('search=USAF'))
  })
})

describe('Vocabulary -> Document cross-linking', () => {
  it('vocab term doc links include ?search= param with term', async () => {
    const user = userEvent.setup()
    const Vocabulary = (await import('../pages/Vocabulary')).default

    renderAtRoute(
      <>
        <Route path="/vocabulary" element={<Vocabulary />} />
        <Route path="/documents/:id" element={<LocationDisplay />} />
      </>,
      { route: '/vocabulary' }
    )

    const termCard = screen.getByText('luminosity')
    await user.click(termCard)

    const docLink = await screen.findByText('UFO Sighting Over Washington')
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('/documents/5'))
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('search=luminosity'))
  })
})

describe('DocumentDetail reads ?search= param', () => {
  it('sets activeQuote from URL search param', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5?search=radar' }
    )

    const searchBars = await screen.findAllByText('radar')
    expect(searchBars.length).toBeGreaterThan(0)
  })
})

describe('DocumentDetail "Back to" breadcrumbs', () => {
  it('shows "Back to Map" when fromMap state is set', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromMap: true } }
    )

    expect(await screen.findByText('Back to Map')).toBeInTheDocument()
  })

  it('shows "Back to Search" with query when fromSearch state is set', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromSearch: true, searchQuery: 'radar' } }
    )

    expect(await screen.findByText(/Back to Search.*radar/)).toBeInTheDocument()
  })

  it('shows "Back to Entities" when fromEntities state is set', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromEntities: true, entityName: 'USAF' } }
    )

    expect(await screen.findByText(/Back to Entities.*USAF/)).toBeInTheDocument()
  })

  it('shows "Back to Cases" when fromCases state is set', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromCases: true, caseId: 'washington_dc_1952', caseName: 'Washington D.C. 1952' } }
    )

    expect(await screen.findByText(/Back to Cases.*Washington/)).toBeInTheDocument()
  })

  it('shows "Back to Network Graph" when fromGraph state is set', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromGraph: true } }
    )

    expect(await screen.findByText('Back to Network Graph')).toBeInTheDocument()
  })

  it('does not show any back link without state', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5' }
    )

    await screen.findByText('UFO Sighting Over Washington')
    expect(screen.queryByText(/Back to/)).not.toBeInTheDocument()
  })
})

describe('Document -> Map link format', () => {
  it('includes lat, lng, zoom, and doc params', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5' }
    )

    await screen.findByText('UFO Sighting Over Washington')
    const mapLink = screen.getByText('Map')
    const href = mapLink.closest('a').getAttribute('href')
    expect(href).toContain('lat=38.9')
    expect(href).toContain('lng=-77')
    expect(href).toContain('zoom=10')
    expect(href).toContain('doc=5')
  })
})

describe('Document -> Graph link format', () => {
  it('includes doc_ prefix in node param', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5' }
    )

    await screen.findByText('UFO Sighting Over Washington')
    const graphLink = screen.getByText('Network Graph')
    expect(graphLink.closest('a')).toHaveAttribute('href', expect.stringContaining('node=doc_5'))
  })
})

describe('Cases deep-linking', () => {
  it('auto-expands case from ?case= param', async () => {
    const Cases = (await import('../pages/Cases')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(CASES_FIXTURE) }))

    renderAtRoute(
      <Route path="/cases" element={<Cases />} />,
      { route: '/cases?case=washington_dc_1952' }
    )

    expect(await screen.findByText('Extended detail.')).toBeInTheDocument()
    expect(screen.getByText('Why High-Validity')).toBeInTheDocument()
  })

  it('does not auto-expand without ?case= param', async () => {
    const Cases = (await import('../pages/Cases')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(CASES_FIXTURE) }))

    renderAtRoute(
      <Route path="/cases" element={<Cases />} />,
      { route: '/cases' }
    )

    await screen.findByText('Washington D.C. 1952')
    expect(screen.queryByText('Extended detail.')).not.toBeInTheDocument()
  })

  it('Related Theories link passes fromCase param', async () => {
    const user = userEvent.setup()
    const Cases = (await import('../pages/Cases')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(CASES_FIXTURE) }))

    renderAtRoute(
      <>
        <Route path="/cases" element={<Cases />} />
        <Route path="/theories" element={<LocationDisplay />} />
      </>,
      { route: '/cases?case=washington_dc_1952' }
    )

    const theoriesLink = await screen.findByText('Related Theories →')
    expect(theoriesLink.closest('a')).toHaveAttribute('href', expect.stringContaining('fromCase=washington_dc_1952'))
  })

  it('case document links pass fromCases state', async () => {
    const Cases = (await import('../pages/Cases')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(CASES_FIXTURE) }))

    renderAtRoute(
      <>
        <Route path="/cases" element={<Cases />} />
        <Route path="/documents/:id" element={<LocationDisplay />} />
      </>,
      { route: '/cases?case=washington_dc_1952' }
    )

    const docLink = await screen.findByText('Doc #68 →')
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('/documents/68'))
  })
})

describe('Theories deep-linking', () => {
  it('auto-expands theory from ?theory= param', async () => {
    const Theories = (await import('../pages/Theories')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(THEORIES_FIXTURE) }))

    renderAtRoute(
      <Route path="/theories" element={<Theories />} />,
      { route: '/theories?theory=extraterrestrial' }
    )

    expect(await screen.findByText('Full description.')).toBeInTheDocument()
    expect(screen.getByText('Key Proponents')).toBeInTheDocument()
  })

  it('shows "Back to Cases" link when fromCase param is set', async () => {
    const Theories = (await import('../pages/Theories')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(THEORIES_FIXTURE) }))

    renderAtRoute(
      <Route path="/theories" element={<Theories />} />,
      { route: '/theories?fromCase=washington_dc_1952' }
    )

    expect(await screen.findByText(/Back to Cases.*washington dc 1952/)).toBeInTheDocument()
  })

  it('Back to Cases link preserves case deep-link param', async () => {
    const Theories = (await import('../pages/Theories')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(THEORIES_FIXTURE) }))

    renderAtRoute(
      <>
        <Route path="/theories" element={<Theories />} />
        <Route path="/cases" element={<LocationDisplay />} />
      </>,
      { route: '/theories?fromCase=washington_dc_1952' }
    )

    const backLink = await screen.findByText(/Back to Cases/)
    expect(backLink.closest('a')).toHaveAttribute('href', expect.stringContaining('case=washington_dc_1952'))
  })
})

describe('Pulse URL state persistence', () => {
  it('reads tab from URL params', async () => {
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <Route path="/pulse" element={<Pulse />} />,
      { route: '/pulse?tab=trends' }
    )

    expect(await screen.findByText('Daily Volume (90 days)')).toBeInTheDocument()
  })

  it('reads platform filter from URL params', async () => {
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <Route path="/pulse" element={<Pulse />} />,
      { route: '/pulse?platform=google_news' }
    )

    await screen.findByText('Live Feed')
    expect(screen.getByText('No items match filters')).toBeInTheDocument()
  })

  it('defaults to feed tab without params', async () => {
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <Route path="/pulse" element={<Pulse />} />,
      { route: '/pulse' }
    )

    expect(await screen.findByText('Live Feed')).toBeInTheDocument()
  })
})

describe('Pulse entity links', () => {
  it('feed item entities link to /entities?q=', async () => {
    const user = userEvent.setup()
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <>
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/entities" element={<LocationDisplay />} />
      </>,
      { route: '/pulse' }
    )

    const feedItem = await screen.findByText('UAP hearing update')
    await user.click(feedItem)

    const entityLink = await screen.findByText(/Pentagon/)
    const anchor = entityLink.closest('a')
    if (anchor) {
      expect(anchor).toHaveAttribute('href', expect.stringContaining('/entities'))
      expect(anchor).toHaveAttribute('href', expect.stringContaining('q=Pentagon'))
    }
  })

  it('trending topics link to /search?q=', async () => {
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <>
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/search" element={<LocationDisplay />} />
      </>,
      { route: '/pulse?tab=trends' }
    )

    const topicLink = await screen.findByText('congressional hearing')
    const anchor = topicLink.closest('a')
    expect(anchor).toHaveAttribute('href', expect.stringContaining('/search'))
    expect(anchor).toHaveAttribute('href', expect.stringContaining('q=congressional'))
  })

  it('entity bridge names link to /entities?q=', async () => {
    const Pulse = (await import('../pages/Pulse')).default

    renderAtRoute(
      <>
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/entities" element={<LocationDisplay />} />
      </>,
      { route: '/pulse?tab=entities' }
    )

    const entityLink = await screen.findByText('Pentagon')
    const anchor = entityLink.closest('a')
    expect(anchor).toHaveAttribute('href', expect.stringContaining('/entities'))
    expect(anchor).toHaveAttribute('href', expect.stringContaining('q=Pentagon'))
  })
})

describe('Map link state', () => {
  it('MapView popup passes fromMap state to document links', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5', state: { fromMap: true } }
    )

    const backLink = await screen.findByText('Back to Map')
    const href = backLink.closest('a').getAttribute('href')
    expect(href).toContain('lat=38.9')
    expect(href).toContain('doc=5')
  })
})

describe('PageReader mobile defaults', () => {
  it('defaults to scan view on mobile widths', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })

    try {
      const PageReader = (await import('../components/PageReader')).default
      render(
        <PageReader
          docId={5}
          pageCount={1}
          pages={['Radar contact established.']}
          redactedPages={[]}
        />
      )

      expect(screen.getByRole('button', { name: 'Scan' })).toHaveClass('bg-slate-700/60')
      expect(screen.getByRole('button', { name: 'Side-by-side' })).not.toHaveClass('bg-slate-700/60')
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
    }
  })
})

describe('Map button always present', () => {
  it('shows Map link for doc with coordinates', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/5' }
    )

    await screen.findByText('UFO Sighting Over Washington')
    const mapLink = screen.getByText('Map')
    const href = mapLink.closest('a').getAttribute('href')
    expect(href).toContain('/map')
    expect(href).toContain('lat=38.9')
    expect(href).toContain('lng=-77')
    expect(href).toContain('doc=5')
  })

  it('shows Map link for doc WITHOUT coordinates', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/103' }
    )

    await screen.findByText('Apollo 11 Technical Crew Debriefing')
    const mapLink = screen.getByText('Map')
    const href = mapLink.closest('a').getAttribute('href')
    expect(href).toContain('/map')
    expect(href).toContain('doc=103')
    expect(href).not.toContain('lat=')
    expect(href).not.toContain('lng=')
  })
})

describe('Document "Explore in" links always present', () => {
  it('always shows Timeline, Network Graph, Map, and Search links', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/103' }
    )

    await screen.findByText('Apollo 11 Technical Crew Debriefing')
    expect(screen.getByText('Network Graph')).toBeInTheDocument()
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
  })

  it('Network Graph link uses doc_ prefix', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/103' }
    )

    await screen.findByText('Apollo 11 Technical Crew Debriefing')
    const graphLink = screen.getByText('Network Graph')
    expect(graphLink.closest('a')).toHaveAttribute('href', expect.stringContaining('node=doc_103'))
  })

  it('Search link encodes doc title', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/103' }
    )

    await screen.findByText('Apollo 11 Technical Crew Debriefing')
    const searchLink = screen.getByText('Search')
    expect(searchLink.closest('a')).toHaveAttribute('href', expect.stringContaining('/search?q='))
  })
})

describe('Back to Map link format for docs without coordinates', () => {
  it('Back to Map link omits lat/lng when doc has no coordinates', async () => {
    const DocumentDetail = (await import('../pages/DocumentDetail')).default

    renderAtRoute(
      <Route path="/documents/:id" element={<DocumentDetail />} />,
      { route: '/documents/103', state: { fromMap: true } }
    )

    const backLink = await screen.findByText('Back to Map')
    const href = backLink.closest('a').getAttribute('href')
    expect(href).toContain('doc=103')
    expect(href).not.toContain('lat=')
  })
})

describe('Entities -> Graph uses correct param', () => {
  it('entity graph link uses ?q= not ?search=', async () => {
    const user = userEvent.setup()
    const Entities = (await import('../pages/Entities')).default

    renderAtRoute(
      <>
        <Route path="/entities" element={<Entities />} />
        <Route path="/graph" element={<LocationDisplay />} />
      </>,
      { route: '/entities' }
    )

    const entityCard = screen.getByText('USAF')
    await user.click(entityCard)

    const graphLink = await screen.findByText('View on Graph')
    const href = graphLink.closest('a').getAttribute('href')
    expect(href).toContain('/graph?q=USAF')
    expect(href).not.toContain('search=')
  })
})

describe('Cases -> Graph uses correct param', () => {
  it('case graph link uses ?q= not ?search=', async () => {
    const Cases = (await import('../pages/Cases')).default

    vi.mocked(globalThis.fetch).mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(CASES_FIXTURE) }))

    renderAtRoute(
      <>
        <Route path="/cases" element={<Cases />} />
        <Route path="/graph" element={<LocationDisplay />} />
      </>,
      { route: '/cases?case=washington_dc_1952' }
    )

    const graphLink = await screen.findByText('View on Graph →')
    const href = graphLink.closest('a').getAttribute('href')
    expect(href).toContain('/graph?q=')
    expect(href).not.toContain('search=')
  })
})

describe('Documents page reads agency filter', () => {
  it('filters by agency from ?agency= param', async () => {
    const Documents = (await import('../pages/Documents')).default

    renderAtRoute(
      <Route path="/documents" element={<Documents />} />,
      { route: '/documents?agency=NASA' }
    )

    await screen.findByText('Apollo 11 Technical Crew Debriefing')
    expect(screen.queryByText('UFO Sighting Over Washington')).not.toBeInTheDocument()
  })
})

describe('Dashboard links use correct params', () => {
  it('briefing card links use valid paths', () => {
    const agencyLinks = [
      '/documents?agency=Department+of+War',
      '/documents?agency=FBI',
      '/documents?agency=NASA',
    ]
    agencyLinks.forEach(path => {
      const params = new URLSearchParams(path.split('?')[1])
      const agency = params.get('agency')
      expect(['Department of War', 'FBI', 'NASA']).toContain(agency)
    })
  })

  it('timeline doc link has valid format', () => {
    const path = '/timeline?doc=103'
    const params = new URLSearchParams(path.split('?')[1])
    expect(params.get('doc')).toBe('103')
  })
})
