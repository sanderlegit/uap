import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import {
  useDocument,
  useDocuments,
  useManifest,
  useGraph,
  useResearch,
  useVocabulary,
  useDocVocabScores,
  agencyClass,
  agencyColor,
  formatDate,
} from '../hooks/useData'
import { useExplorationTrail } from '../hooks/useExplorationTrail'
import useDocPrefs from '../hooks/useDocPrefs'
import DocThumbnail from '../components/DocThumbnail'
import PageReader from '../components/PageReader'
import VocabBadge from '../components/VocabBadge'

const BADGE_SYNONYMS = {
  cloaking: 'cloak|invisible|disappear|vanish|fade',
  luminosity_change: 'bright|glow|luminous|pulsing|flashing|illuminat',
  formation: 'formation|in a line|triangle|V-shape|diamond|group',
  hovering: 'hover|stationary|motionless|stood still|hung in',
  merging: 'merg|combin|join|unit|fuse',
  splitting: 'split|separat|divid|broke apart',
  direction_change: 'direction|sharp turn|abrupt|revers|zigzag',
  acceleration: 'accelerat|burst of speed|instantan|rapid',
  EM_interference: 'interferen|electromagnet|static|radio|compass|electrical',
  'infrared/FLIR': 'infrared|FLIR|thermal|IR sensor|heat signature',
  signals_intelligence: 'signal|SIGINT|intercept|electronic|emission',
  'electro-optical': 'electro-optical|EO|optical sensor',
  photographic: 'photograph|photo|camera|film|image',
  'light/orb': 'light|orb|glow|bright|luminous',
}

const LEGACY_SEARCH_TERMS = {
  sandia: 'sandia',
  wright_patterson: 'wright-patterson',
  blue_book: 'blue book',
  cia_oga: 'cia',
  nro: 'satellite',
  doe_aec: 'atomic',
  lanl_ornl_battelle: 'los alamos',
  lockheed_skunkworks: 'lockheed',
  battelle: 'battelle',
}

function cleanMentionTerm(term) {
  return (term || '')
    .split(',')[0]
    .replace(/\\\?\.|\.\\\?/g, '-')
    .replace(/\.\?/g, '-')
    .replace(/\\b|\\/g, '')
    .replace(/[()[\]{}^$*+?|]/g, '')
    .trim()
}

function getReasonSearchTerm(reason) {
  const text = Array.isArray(reason) ? reason.join('; ') : reason || ''
  const match = text.match(/Content mentions:\s*([^;(]+)/i)
  return cleanMentionTerm(match?.[1])
}

function getLegacySearchTerm(conn) {
  if (!conn) return ''
  const reasonTerm = getReasonSearchTerm(conn.reasons || conn.reasoning || conn.reason)
  if (reasonTerm) return reasonTerm
  const id = conn.nodeId || conn.id
  if (LEGACY_SEARCH_TERMS[id]) return LEGACY_SEARCH_TERMS[id]
  return (conn.label || '').split(/\s+/)[0]?.replace(/[^\w-]/g, '').toLowerCase() || ''
}

function findBestSearchTerm(label, text) {
  const synonyms = BADGE_SYNONYMS[label]
  if (!synonyms || !text) return null
  const words = synonyms.split('|')
  const lower = text.toLowerCase()
  for (const w of words) {
    if (lower.includes(w.toLowerCase())) return w
  }
  return null
}

function QuoteCarousel({ quotes, onQuoteClick }) {
  const [idx, setIdx] = useState(0)
  if (!quotes || quotes.length === 0) return null
  const q = quotes[idx]
  const multi = quotes.length > 1
  return (
    <div className="mt-1.5 border-l-2 border-amber-500/40 bg-amber-500/5 rounded-r">
      <button
        onClick={() => onQuoteClick({ quote: q.text, page: q.page })}
        className="block w-full text-left pl-3 pr-2 py-1.5 cursor-pointer hover:bg-amber-500/10 hover:border-amber-400/60 transition-colors group"
      >
        <span className="text-xs text-amber-200/70 italic leading-relaxed line-clamp-2 group-hover:text-amber-200/90">
          &ldquo;{q.text}&rdquo;
        </span>
        {q.page != null && (
          <span className="text-[10px] text-amber-500/50 ml-2 group-hover:text-amber-400/70">p.{q.page} &rarr;</span>
        )}
      </button>
      {multi && (
        <div className="flex items-center gap-2 pl-3 pb-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + quotes.length) % quotes.length) }}
            className="text-[10px] text-amber-500/50 hover:text-amber-400 cursor-pointer px-1"
          >&larr;</button>
          <span className="text-[10px] text-amber-500/40 font-mono">{idx + 1}/{quotes.length}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % quotes.length) }}
            className="text-[10px] text-amber-500/50 hover:text-amber-400 cursor-pointer px-1"
          >&rarr;</button>
        </div>
      )}
    </div>
  )
}

const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}

const LAYER_LABELS = {
  surveillance: 'Surveillance',
  custodial: 'Custodial',
  industrial: 'Industrial',
  center: 'Core',
}

function Badge({ children, color }) {
  return (
    <span
      className="inline-block px-2.5 py-1 rounded text-[11px] font-medium"
      style={{
        backgroundColor: color ? `${color}20` : 'rgba(100,116,139,0.2)',
        color: color || '#94a3b8',
      }}
    >
      {children}
    </span>
  )
}

function Section({ title, defaultOpen = true, children, count }) {
  return (
    <details open={defaultOpen || undefined} className="group">
      <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-colors">
        <span className="text-[10px] text-slate-500 group-open:rotate-90 transition-transform">&#9654;</span>
        {title}
        {count != null && (
          <span className="text-[10px] font-normal text-slate-500">({count})</span>
        )}
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-24 mb-4" />
      <div className="h-6 bg-slate-700 rounded w-3/4 mb-3" />
      <div className="flex gap-2 mb-6">
        <div className="h-5 bg-slate-700 rounded w-12" />
        <div className="h-5 bg-slate-700 rounded w-24" />
        <div className="h-5 bg-slate-700 rounded w-20" />
      </div>
      <div className="h-24 bg-slate-800 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-800/60 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  )
}


export default function DocumentDetail() {
  const { id } = useParams()
  const numId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlSearchTerm = searchParams.get('search')
  const fromGraph = location.state?.fromGraph
  const graphNodeId = location.state?.nodeId
  const graphContextNodeId = location.state?.graphContextNodeId
  const graphContextLabel = location.state?.graphContextLabel
  const fromMap = location.state?.fromMap
  const fromSearch = location.state?.fromSearch
  const searchQuery = location.state?.searchQuery
  const fromEntities = location.state?.fromEntities
  const entityName = location.state?.entityName
  const fromCases = location.state?.fromCases
  const caseId = location.state?.caseId
  const caseName = location.state?.caseName
  const doc = useDocument(numId)
  const docs = useDocuments()
  const manifest = useManifest()
  const graph = useGraph()
  const research = useResearch()
  const vocabulary = useVocabulary()
  const vocabScores = useDocVocabScores()

  const [narratives, setNarratives] = useState(null)
  const [legacyWeb, setLegacyWeb] = useState(null)
  const [activeQuote, setActiveQuote] = useState(null)
  const [mobileTab, setMobileTab] = useState('document')
  const pageReaderRef = useRef(null)
  const docTopRef = useRef(null)

  const { addToTrail } = useExplorationTrail()
  const { markRead, isStarred, toggleStar, isSuggested } = useDocPrefs()

  useEffect(() => { markRead(numId) }, [numId, markRead])

  useEffect(() => {
    document.documentElement.classList.add('doc-detail-open')
    return () => document.documentElement.classList.remove('doc-detail-open')
  }, [])

  const docVocabTerms = useMemo(() => {
    if (!vocabulary || !vocabScores) return null
    const scores = vocabScores[String(numId)]
    if (!scores || !scores.top_terms || scores.top_terms.length === 0) return null
    const termMap = new Map(scores.top_terms.map(t => [t.term.toLowerCase(), t.count]))
    return vocabulary.terms
      .filter(t => termMap.has(t.term.toLowerCase()))
      .map(t => ({ term: t.term, loading: t.loading, category: t.category, definition: t.definition, count: termMap.get(t.term.toLowerCase()) || 0 }))
      .sort((a, b) => b.loading - a.loading || b.count - a.count)
  }, [vocabulary, vocabScores, numId])

  const docVocabScore = vocabScores?.[String(numId)]

  useEffect(() => {
    if (doc) {
      addToTrail({ type: 'document', id: numId, title: doc.title, path: '/documents/' + numId })
    }
  }, [doc, numId, addToTrail])

  useEffect(() => {
    if (docTopRef.current) {
      docTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [numId])

  useEffect(() => {
    if (urlSearchTerm) {
      setActiveQuote({ searchTerm: urlSearchTerm })
      setMobileTab('document')
    }
  }, [urlSearchTerm, numId])

  useEffect(() => {
    fetch('/data/doc_narratives.json')
      .then(r => r.json())
      .then(setNarratives)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/data/legacy_web.json')
      .then(r => r.json())
      .then(setLegacyWeb)
      .catch(() => {})
  }, [])

  const manifestEntry = useMemo(() => {
    if (!manifest || !doc) return null
    return manifest[doc.filename] || null
  }, [manifest, doc])

  const narrative = narratives?.[String(numId)]

  const crossRefs = useMemo(() => {
    if (!graph || !docs) return []
    const connected = graph.edges
      .filter(e => e.source_id === numId || e.target_id === numId)
      .map(e => ({
        id: e.source_id === numId ? e.target_id : e.source_id,
        weight: e.weight,
        edge_type: e.edge_type,
      }))
      .sort((a, b) => b.weight - a.weight)

    return connected.map(c => {
      const refDoc = docs.find(d => d.id === c.id)
      return refDoc ? { ...c, title: refDoc.title, agency: refDoc.agency } : null
    }).filter(Boolean)
  }, [graph, docs, numId])

  const legacyConnections = useMemo(() => {
    if (!legacyWeb) return []
    const docNodeId = `doc_${numId}`
    const nodeMap = new Map(legacyWeb.nodes.map(n => [n.id, n]))
    return legacyWeb.edges
      .filter(e => e.source === docNodeId && e.type === 'document')
      .map(e => {
        const node = nodeMap.get(e.target)
        if (!node) return null
        return {
          nodeId: node.id,
          label: node.label,
          layer: node.layer,
          color: node.color,
          description: node.description,
          weight: e.weight,
          reasons: (e.reason || '').split(';').map(r => r.trim()).filter(Boolean),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
  }, [legacyWeb, numId])

  const researchContext = useMemo(() => {
    if (!research || !doc) return []
    const fname = (doc.filename || '').replace('.pdf', '').toLowerCase()
    return (research.correlations || []).filter(c =>
      c.related_docs?.some(rd => {
        const rdLower = rd.toLowerCase()
        return fname && (fname.includes(rdLower) || rdLower.includes(fname))
      })
    )
  }, [research, doc])

  const handleQuoteClick = useCallback(({ quote, page }) => {
    setMobileTab('document')
    setActiveQuote({ quote, page, category: 'quote' })
    setTimeout(() => {
      if (pageReaderRef.current) {
        pageReaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }, [])

  const handleBadgeClick = useCallback((term, category) => {
    setMobileTab('document')
    const fullText = doc?.full_text || ''
    const found = findBestSearchTerm(term, fullText)
    if (found) {
      setActiveQuote({ searchTerm: found, category })
    } else {
      const fallback = term
        .replace(/[/_-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .sort((a, b) => b.length - a.length)[0] || term
      setActiveQuote({ searchTerm: fallback, category })
    }
    setTimeout(() => {
      if (pageReaderRef.current) {
        pageReaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }, [doc])

  const handleLegacyFind = useCallback((conn) => {
    const searchTerm = getLegacySearchTerm(conn)
    if (!searchTerm) return
    setMobileTab('document')
    setActiveQuote({ searchTerm, category: 'quote' })
    setTimeout(() => {
      pageReaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  const prevId = numId > 0 ? numId - 1 : null
  const nextId = docs && numId < docs.length - 1 ? numId + 1 : null

  const pages = useMemo(() => {
    if (!doc?.full_text) return []
    return doc.full_text.split('--- PAGE BREAK ---')
  }, [doc])

  if (!doc) return <LoadingSkeleton />

  const acls = agencyClass(doc.agency)
  const acol = agencyColor(doc.agency)

  const hasSensors = doc.sensors?.length > 0
  const hasBehaviors = doc.behaviors?.length > 0
  const hasShapes = doc.shapes?.length > 0
  const hasWitnesses = doc.witnesses?.length > 0
  const hasEntities = doc.entities?.length > 0
  const hasRedaction = doc.has_redaction === 1
  const hasCrossRefs = crossRefs.length > 0 || doc.cross_refs?.length > 0
  const hasMetadata = hasSensors || hasBehaviors || hasShapes || hasWitnesses || hasEntities

  const legacyContextContent = legacyConnections.length > 0 && (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-amber-400">Legacy Program Context</h2>
        <Link to={`/graph?node=doc_${numId}`} className="text-[11px] text-amber-500/60 hover:text-amber-400 transition-colors">
          View in graph &rarr;
        </Link>
      </div>
      <div className="space-y-3">
        {legacyConnections.map(conn => (
          <div key={conn.nodeId} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-24 mt-1.5">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${conn.weight * 100}%`, backgroundColor: conn.color }}
                />
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 text-right font-mono">{conn.weight.toFixed(2)}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{conn.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${conn.color}15`, color: conn.color }}>
                  {LAYER_LABELS[conn.layer] || conn.layer}
                </span>
                {getLegacySearchTerm(conn) && (
                  <button
                    onClick={() => handleLegacyFind(conn)}
                    className="ml-auto text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                  >
                    Find in text
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {conn.reasons.map((r, i) => (
                  <p key={i} className="text-xs text-slate-400 leading-relaxed">
                    {r}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const whyThisMattersContent = (narrative?.why_it_matters || manifestEntry?.description) && (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/20 border border-blue-500/20 rounded-lg p-5 mb-6">
      <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-blue-400 mb-2">Why This Matters</h2>
      <p className="text-sm text-slate-200 leading-relaxed">
        {narrative?.why_it_matters || manifestEntry?.description}
      </p>
    </div>
  )

  const extractedEvidenceContent = (hasSensors || hasBehaviors || hasShapes || hasWitnesses) && (
    <div className="mb-6 py-3 px-4 bg-slate-800/30 border border-slate-700/40 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-slate-500">Extracted Evidence</span>
        <span className="text-[10px] text-slate-600 italic">pattern-matched from text</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {hasSensors && (
          <div>
            <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-blue-400/70 mb-1.5">Sensors</div>
            <div className="flex flex-wrap gap-1.5">
              {doc.sensors.map((s, i) => {
                const match = findBestSearchTerm(s.sensor_type, doc.full_text)
                return (
                  <button key={i} onClick={() => handleBadgeClick(s.sensor_type, 'sensor')} className="cursor-pointer hover:brightness-125 transition-all"
                    title={match ? `Click to find "${match}" in text` : `Inferred from: ${(BADGE_SYNONYMS[s.sensor_type] || s.sensor_type).replace(/\|/g, ', ')}`}>
                    <Badge color="#3b82f6">
                      {s.sensor_type}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}{!match && ' *'}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {hasBehaviors && (
          <div>
            <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-amber-400/70 mb-1.5">Behaviors</div>
            <div className="flex flex-wrap gap-1.5">
              {doc.behaviors.map((b, i) => {
                const match = findBestSearchTerm(b, doc.full_text)
                return (
                  <button key={i} onClick={() => handleBadgeClick(b, 'behavior')} className="cursor-pointer hover:brightness-125 transition-all"
                    title={match ? `Click to find "${match}" in text` : `Inferred from: ${(BADGE_SYNONYMS[b] || b).replace(/\|/g, ', ')}`}>
                    <Badge color="#f59e0b">{b.replace(/_/g, ' ')}{!match && ' *'}</Badge>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {hasShapes && (
          <div>
            <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-purple-400/70 mb-1.5">Shapes</div>
            <div className="flex flex-wrap gap-1.5">
              {doc.shapes.map((s, i) => {
                const match = findBestSearchTerm(s.shape, doc.full_text)
                return (
                  <button key={i} onClick={() => handleBadgeClick(s.shape, 'shape')} className="cursor-pointer hover:brightness-125 transition-all"
                    title={match ? `Click to find "${match}" in text` : `Inferred from: ${(BADGE_SYNONYMS[s.shape] || s.shape).replace(/\|/g, ', ')}`}>
                    <Badge color="#8b5cf6">
                      {s.shape}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}{!match && ' *'}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {hasWitnesses && (
          <div>
            <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-emerald-400/70 mb-1.5">Witnesses</div>
            <div className="flex flex-wrap gap-1.5">
              {doc.witnesses.map((w, i) => (
                <button key={i} onClick={() => handleBadgeClick(w, 'witness')} className="cursor-pointer hover:brightness-125 transition-all"
                  title={`Click to find "${w}" in text`}>
                  <Badge color="#10b981">{w}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 text-[10px] text-slate-600">* no exact match — click to search synonym</div>
    </div>
  )

  const desktopSummaryContent = (
    <div className="hidden md:grid max-w-[1800px] mx-auto px-4 py-4 grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4 border-t border-slate-800/50">
      <div>{whyThisMattersContent}</div>
      <div>
        {extractedEvidenceContent}
        {legacyContextContent}
      </div>
    </div>
  )

  const analysisContent = (
    <>
      {/* ── "Why This Matters" ─────────────────────────────────────── */}
      <div className="md:hidden">{whyThisMattersContent}</div>

      {/* ── Document Evidence (sensors, behaviors, shapes, witnesses) ── */}
      <div className="md:hidden">{extractedEvidenceContent}</div>

      {/* ── Legacy Program Context ─────────────────────────────────── */}
      <div className="md:hidden">{legacyContextContent}</div>

      {/* ── Key Findings ───────────────────────────────────────────── */}
      {narrative?.key_findings?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Key Findings</h2>
          <div className="space-y-3">
            {narrative.key_findings.map((finding, i) => {
              const isObj = typeof finding === 'object' && finding !== null
              const text = isObj ? finding.finding : finding
              const quotes = isObj
                ? (finding.quotes || (finding.quote ? [{ text: finding.quote, page: finding.page }] : []))
                : []
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
                    <QuoteCarousel quotes={quotes} onQuoteClick={handleQuoteClick} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Vocabulary Analysis ─────────────────────────────────────── */}
      {docVocabTerms && docVocabTerms.length > 0 && (
        <div className="bg-teal-950/20 border border-teal-900/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-teal-400">Loaded Vocabulary</h2>
              {docVocabScore && (
                <span className="text-[11px] text-teal-400/60 font-mono">
                  score {docVocabScore.score} · {docVocabScore.loaded_term_count} terms · {docVocabScore.total_term_count} occurrences
                </span>
              )}
            </div>
            <Link to="/vocabulary" className="text-[11px] text-teal-500/60 hover:text-teal-400 transition-colors">
              Full glossary &rarr;
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {docVocabTerms.map(t => {
              const colors = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' }
              const labels = { 1: 'Neutral', 2: 'Mild', 3: 'Loaded', 4: 'Shibboleth' }
              const c = colors[t.loading] || colors[1]
              return (
                <button
                  key={t.term}
                  onClick={() => handleBadgeClick(t.term, 'vocab')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer hover:brightness-125 transition-all"
                  style={{ backgroundColor: `${c}15`, color: c }}
                  title={`${t.term} [${labels[t.loading]}] — ${t.definition || t.category}\n${t.count} occurrence${t.count !== 1 ? 's' : ''} in this document`}
                >
                  <span className="flex gap-px">
                    {[1, 2, 3, 4].map(i => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-sm"
                        style={{ backgroundColor: i <= t.loading ? c : 'rgba(100,116,139,0.2)' }}
                      />
                    ))}
                  </span>
                  {t.term}
                  {t.count > 1 && <span style={{ color: `${c}99` }}>({t.count})</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Official Description ───────────────────────────────────── */}
      {manifestEntry?.description && (
        <div className="mb-4">
          <Section title="Official Pentagon Description" defaultOpen={false}>
            <p className="text-sm text-slate-400 leading-relaxed">{manifestEntry.description}</p>
          </Section>
        </div>
      )}

      {/* ── Entities Mentioned ─────────────────────────────────────── */}
      {hasEntities && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          <Section title="Entities Mentioned" count={doc.entities.length} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {doc.entities.map((e, i) => (
                <Link key={i} to={`/entities?q=${encodeURIComponent(e.entity_value)}`} className="hover:brightness-125 transition-all">
                  <Badge color={e.entity_type === 'organization' ? '#3b82f6' : e.entity_type === 'person' ? '#ec4899' : '#6b7280'}>
                    <span className="opacity-60 mr-1">{e.entity_type}:</span>{e.entity_value}
                  </Badge>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Redaction Info ──────────────────────────────────────────── */}
      {hasRedaction && doc.redaction?.length > 0 && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 mb-4">
          <Section title="Redaction Details" defaultOpen>
            <div className="space-y-1.5">
              {doc.redaction.map((r, i) => (
                <div key={i} className="text-sm text-red-300/80">
                  <span className="text-red-400 font-medium">{r.redacted_pages}</span> page{r.redacted_pages !== 1 ? 's' : ''} with redactions
                  {r.black_rect_count > 0 && (
                    <span className="text-red-400/60 ml-2">
                      ({r.black_rect_count} black rectangle{r.black_rect_count !== 1 ? 's' : ''}, {(r.black_area_pct * 100).toFixed(1)}% area)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Related Documents ──────────────────────────────────────── */}
      {hasCrossRefs && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          <Section title="Related Documents" count={crossRefs.length} defaultOpen>
            <div className="space-y-1.5">
              {crossRefs.slice(0, 8).map(ref => (
                <Link
                  key={ref.id}
                  to={`/documents/${ref.id}`}
                  className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-slate-700/30 transition-colors group"
                >
                  <DocThumbnail docId={ref.id} size="sm" className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`agency-badge ${agencyClass(ref.agency)} shrink-0`}>
                        {AGENCY_SHORT[ref.agency] || ref.agency}
                      </span>
                      <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-1">
                        {ref.title}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {(ref.weight * 100).toFixed(0)}%
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Research Context ───────────────────────────────────────── */}
      {researchContext.length > 0 && (
        <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-4 mb-4">
          <Section title="Research Context" defaultOpen>
            <div className="space-y-3">
              {researchContext.map((rc, i) => (
                <div key={i}>
                  <h4 className="text-sm font-medium text-indigo-300 mb-1">{rc.topic}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">{rc.context}</p>
                  {rc.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {rc.sources.map((s, j) => (
                        <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Extraction info ────────────────────────────────────────── */}
      <div className="text-[11px] text-slate-500 mb-6">
        Extracted via {doc.extraction_method}{doc.ocr_applied ? ' + OCR' : ''}
        {' · '}Source: <a href="https://war.gov/UFO" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">war.gov/UFO</a>
      </div>
    </>
  )

  const documentContent = (
    <div ref={pageReaderRef}>
      {doc.total_pages > 0 && (
        <PageReader
          docId={numId}
          pageCount={doc.total_pages}
          pages={pages}
          redactedPages={doc.redaction?.flatMap(r => {
            const count = r.redacted_pages || 0
            return count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : []
          })}
          originalUrl={manifestEntry?.url}
          activeQuote={activeQuote}
          onClearQuote={() => setActiveQuote(null)}
          vocabTerms={docVocabTerms}
          findings={narrative?.key_findings}
        />
      )}
    </div>
  )

  return (
    <div className="md:pb-20 max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:bottom-14 max-md:flex max-md:flex-col max-md:overflow-hidden max-md:bg-slate-950 max-md:z-10">
      <div className="max-md:flex-1 max-md:overflow-y-auto max-md:overflow-x-hidden">
      {/* ── Shared header ─────────────────────────────────────────── */}
      <div ref={docTopRef} className="max-w-7xl mx-auto px-4 py-6">
        {fromGraph && (
          <Link
            to={{
              pathname: '/graph',
              search: new URLSearchParams({
                ...(graphNodeId ? { node: graphNodeId } : {}),
                ...(graphContextNodeId ? { org: graphContextNodeId } : {}),
              }).toString(),
            }}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Network Graph{graphContextLabel ? `: ${graphContextLabel}` : ''}</span>
          </Link>
        )}
        {fromMap && (
          <Link
            to={`/map?${doc.latitude != null && doc.longitude != null ? `lat=${doc.latitude}&lng=${doc.longitude}&zoom=10&` : ''}doc=${doc.id}`}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Map</span>
          </Link>
        )}
        {fromSearch && (
          <Link
            to={`/search${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Search{searchQuery ? `: "${searchQuery}"` : ''}</span>
          </Link>
        )}
        {fromEntities && (
          <Link
            to={`/entities${entityName ? `?q=${encodeURIComponent(entityName)}` : ''}`}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Entities{entityName ? `: ${entityName}` : ''}</span>
          </Link>
        )}
        {fromCases && (
          <Link
            to={`/cases${caseId ? `?case=${encodeURIComponent(caseId)}` : ''}`}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Cases{caseName ? `: ${caseName}` : ''}</span>
          </Link>
        )}
        <div className="mb-4">
          <div className="flex items-start gap-2 mb-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug flex-1">{doc.title}</h1>
            <button
              onClick={() => toggleStar(numId)}
              className="mt-1 shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer group"
              title={isStarred(numId) ? 'Remove from starred' : 'Star this document'}
            >
              {isStarred(numId) ? (
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-slate-600 group-hover:text-amber-400/60 transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="agency-badge text-sm px-3 py-1"
              style={{ backgroundColor: `${acol}20`, color: acol }}
            >
              {AGENCY_SHORT[doc.agency] || doc.agency}
            </span>
            {doc.incident_date_parsed && (
              <span className="text-sm text-slate-400">{formatDate(doc.incident_date_parsed)}</span>
            )}
            {doc.incident_location && doc.incident_location !== 'N/A' && (
              <span className="text-sm text-slate-500">{doc.incident_location}</span>
            )}
            <span className="text-xs text-slate-500 bg-slate-800 rounded px-2.5 py-1">
              {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}
            </span>
            {hasRedaction && (
              <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 rounded px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Redacted
              </span>
            )}
            <VocabBadge docId={numId} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Explore in:</span>
          {doc.incident_date_parsed && (
            <Link to={`/timeline?doc=${doc.id}${doc.decade ? `&decade=${doc.decade}` : ''}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
              Timeline
            </Link>
          )}
          <Link to={`/graph?node=doc_${doc.id}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Network Graph
          </Link>
          <Link to={`/map?${doc.latitude != null && doc.longitude != null ? `lat=${doc.latitude}&lng=${doc.longitude}&zoom=10&` : ''}doc=${doc.id}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Map
          </Link>
          <Link to={`/search?q=${encodeURIComponent(doc.title)}`} className="hidden md:inline-block px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Search
          </Link>
        </div>
      </div>

      {desktopSummaryContent}

      {/* ── Mobile tab bar ────────────────────────────────────────── */}
      <div className="md:hidden sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-700/50">
        <div className="flex">
          {['analysis', 'document'].map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors cursor-pointer relative ${
                mobileTab === tab ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              {tab === 'analysis' ? 'Analysis' : 'Document'}
              {mobileTab === tab && (
                <span className="absolute bottom-0 inset-x-6 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop: side-by-side ─────────────────────────────────── */}
      <div className="hidden md:flex mx-auto sticky top-14 max-w-[1800px]" style={{ height: 'calc(100vh - 56px - 44px)' }}>
        <div className="w-[420px] lg:w-[480px] shrink-0 overflow-y-auto px-4 py-4">
          {analysisContent}
        </div>
        <div className="flex-1 min-w-0 overflow-y-auto border-l border-slate-700/30 px-6 py-4">
          {documentContent}
        </div>
      </div>

      {/* ── Mobile: tabbed content ────────────────────────────────── */}
      <div className="md:hidden px-4 pb-16">
        {mobileTab === 'analysis' ? analysisContent : documentContent}
      </div>
      </div>

      {/* ── Previous / Next navigation (pinned) ─────────────────────── */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-sm border-t border-slate-700/50">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between px-4 py-2">
          {prevId != null ? (
            <button
              onClick={() => navigate(`/documents/${prevId}`)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1.5 px-3"
            >
              <span>&larr;</span>
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}
          <Link to="/documents" className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5 px-3">
            All documents
          </Link>
          {nextId != null ? (
            <button
              onClick={() => navigate(`/documents/${nextId}`)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1.5 px-3"
            >
              <span>Next</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  )
}
