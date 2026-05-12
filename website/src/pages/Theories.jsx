import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LegacyProgramChart from '../components/LegacyProgramChart'

const SIDEBAR_STATIC = [
  { id: 'framework', label: 'Interactive Framework', depth: 0 },
  { id: 'layer-1', label: 'Surveillance Layer', depth: 1 },
  { id: 'layer-1-nro', label: 'NRO — Detection', depth: 2 },
  { id: 'layer-1-cia', label: 'CIA — Recovery', depth: 2 },
  { id: 'layer-1-aaro', label: 'AARO / Historical', depth: 2 },
  { id: 'layer-2', label: 'Custodial Layer', depth: 1 },
  { id: 'layer-2-doe', label: 'DOE — Classification', depth: 2 },
  { id: 'layer-2-ffrdcs', label: 'FFRDCs', depth: 2 },
  { id: 'layer-3', label: 'Industrial Layer', depth: 1 },
  { id: 'layer-3-lockheed', label: 'Lockheed Skunk Works', depth: 2 },
  { id: 'layer-3-northrop', label: 'Northrop Grumman', depth: 2 },
  { id: 'layer-3-saic', label: 'SAIC & Others', depth: 2 },
  { id: 'personnel', label: 'Personnel Network', depth: 1 },
  { id: 'kill-chain', label: 'Kill Chain', depth: 1 },
  { id: 'nav-hub', label: 'Navigation', depth: 0 },
  { id: 'hypotheses', label: 'Competing Hypotheses', depth: 0 },
]

function buildSidebarSections(theories) {
  const theoryItems = (theories || []).map(t => ({
    id: `theory-${t.id}`, label: t.name.replace(/ \(.*\)$/, ''), depth: 1,
  }))
  return [
    ...SIDEBAR_STATIC,
    ...theoryItems,
    { id: 'researchers', label: 'Key Researchers', depth: 0 },
    { id: 'community', label: 'Community Sources', depth: 0 },
  ]
}

const DEPTH_PL = ['pl-0', 'pl-3', 'pl-6']

function SectionSidebar({ theories }) {
  const [activeId, setActiveId] = useState('')
  const sections = useMemo(() => buildSidebarSections(theories), [theories])

  useEffect(() => {
    let observer
    let prevCount = 0

    function setup() {
      const els = sections.map(s => document.getElementById(s.id)).filter(Boolean)
      if (els.length === prevCount) return
      prevCount = els.length
      if (!els.length) return

      if (observer) observer.disconnect()
      observer = new IntersectionObserver(
        entries => {
          const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          if (visible.length) setActiveId(visible[0].target.id)
        },
        { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
      )
      els.forEach(el => observer.observe(el))
    }

    setup()
    const mutObs = new MutationObserver(setup)
    mutObs.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (observer) observer.disconnect()
      mutObs.disconnect()
    }
  }, [sections])

  function scrollTo(id) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const ancestors = useMemo(() => {
    const set = new Set()
    const idx = sections.findIndex(s => s.id === activeId)
    if (idx < 0) return set
    const activeDepth = sections[idx].depth
    for (let d = activeDepth - 1; d >= 0; d--) {
      for (let i = idx - 1; i >= 0; i--) {
        if (sections[i].depth === d) { set.add(sections[i].id); break }
      }
    }
    return set
  }, [activeId, sections])

  return (
    <nav className="hidden 2xl:block fixed top-20 w-48" style={{ left: 'max(1rem, calc((100vw - 72rem) / 2 - 13rem))' }}>
      <div className="space-y-px">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2.5">On this page</div>
        {sections.map(s => {
          const isActive = activeId === s.id
          const isAncestor = ancestors.has(s.id)
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`block w-full text-left cursor-pointer transition-all text-[11px] leading-snug py-1 rounded-r-sm ${
                DEPTH_PL[s.depth] || 'pl-0'
              } ${
                isActive
                  ? 'text-indigo-300 font-semibold bg-indigo-500/10 border-l-2 border-indigo-400'
                  : isAncestor
                    ? 'text-slate-300 border-l-2 border-slate-600'
                    : 'text-slate-500 hover:text-slate-300 border-l-2 border-transparent'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) return
    const start = performance.now()
    let raf
    function tick(now) {
      const p = Math.min((now - start) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

const THEORY_CASE_CATEGORIES = {
  extraterrestrial: ['military_encounter', 'close_encounter'],
  advanced_human_tech: ['military_encounter', 'historical_military'],
  natural_phenomena: ['/cases'],
  interdimensional: ['close_encounter'],
}

function PopularityBar({ label, value, color }) {
  const display = useCountUp(value)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] text-slate-400 tabular-nums w-8 text-right">{display}%</span>
    </div>
  )
}

function TheoryCard({ theory, isExpanded, onToggle }) {
  return (
    <div
      id={`theory-${theory.id}`}
      className={`bg-slate-900 rounded-lg overflow-hidden border-l-2 transition-colors ${
        isExpanded
          ? 'border-l-current border-slate-700/60'
          : 'border-l-transparent border border-slate-800 hover:border-slate-700/60'
      }`}
      style={isExpanded ? { borderLeftColor: theory.color, borderRight: '1px solid rgb(51 65 85 / 0.6)', borderTop: '1px solid rgb(51 65 85 / 0.6)', borderBottom: '1px solid rgb(51 65 85 / 0.6)' } : undefined}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl shrink-0" style={{ color: theory.color }}>
            {theory.icon}
          </span>
          <h3 className="text-sm font-semibold text-slate-200">{theory.name}</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{theory.short}</p>
        <div className="space-y-1.5">
          <PopularityBar label="Popularity" value={theory.popularity} color={theory.color} />
          <PopularityBar label="Sci. support" value={theory.scientific_support} color={theory.color} />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800 px-5 py-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">{theory.description}</p>
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Key Proponents</h4>
                <div className="flex flex-wrap gap-2">
                  {theory.key_proponents.map((p, i) => (
                    <span key={i} className="px-2.5 py-1 rounded text-xs bg-slate-800 text-slate-300">{p}</span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Evidence Cited</h4>
                <ul className="space-y-1.5">
                  {theory.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-slate-400 leading-relaxed pl-3 border-l border-slate-700/60">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 content-start">
              <div>
                <h4 className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider mb-2">Strengths</h4>
                <ul className="space-y-1.5">
                  {theory.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-400 pl-3 border-l border-emerald-600/40">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-red-400/80 uppercase tracking-wider mb-2">Weaknesses</h4>
                <ul className="space-y-1.5">
                  {theory.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-slate-400 pl-3 border-l border-red-600/40">{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {theory.sources.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {theory.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                    {s.title}
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {(THEORY_CASE_CATEGORIES[theory.id] || ['/cases']).map((cat, i) =>
                cat.startsWith('/') ? (
                  <Link key={i} to={cat} className="text-xs text-blue-400 hover:text-blue-300">
                    Browse Cases &rarr;
                  </Link>
                ) : (
                  <Link key={i} to={`/cases?category=${cat}`} className="text-xs text-blue-400 hover:text-blue-300">
                    {cat.replace(/_/g, ' ')} cases &rarr;
                  </Link>
                )
              )}
              <Link
                to={`/search?q=${encodeURIComponent(theory.name.split(/\s+/).find(w => w.length > 3 && !/^(the|and|with)$/i.test(w)) || theory.name)}`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Documents &rarr;
              </Link>
              <Link to="/analysis/report" className="text-xs text-blue-400 hover:text-blue-300">
                Analysis &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function ResearcherCard({ r }) {
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      className="block bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700/60 hover:bg-slate-800/30 transition-colors group">
      <div className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{r.name}</div>
      <div className="text-xs text-slate-500 mb-1.5">{r.affiliation}</div>
      <div className="text-xs text-indigo-400/70 mb-1.5">{r.focus}</div>
      <p className="text-xs text-slate-400 leading-relaxed">{r.key_finding}</p>
    </a>
  )
}

function CommunitySource({ source }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <a href={source.url} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold text-slate-200 hover:text-indigo-300 transition-colors">
          {source.name}
        </a>
        <span className="text-[11px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">{source.type}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{source.description}</p>
      {source.notable_content && (
        <div className="mb-3">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Notable Content</h4>
          <ul className="space-y-1">
            {source.notable_content.slice(0, 4).map((c, i) => (
              <li key={i} className="text-xs text-slate-400 pl-3 border-l border-indigo-600/30">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {source.key_resources && (
        <div className="mb-3">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Key Resources</h4>
          {source.key_resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              className="block mb-1.5 last:mb-0">
              <span className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">{r.name}</span>
              <span className="text-xs text-slate-500 ml-1.5">{r.description}</span>
            </a>
          ))}
        </div>
      )}
      {source.stats_2025 && (
        <div className="pt-3 border-t border-slate-800">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.total_cases?.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Total Cases</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.field_investigators}+</div>
              <div className="text-xs text-slate-500">Investigators</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.countries}</div>
              <div className="text-xs text-slate-500">Countries</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 space-y-4">
        <div className="h-6 w-48 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-800/40 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-slate-800/40 rounded animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Theories() {
  const [data, setData] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedTheories, setExpandedTheories] = useState(() => new Set())
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  const sortBy = searchParams.get('sort') || 'popularity'
  const theoryParam = searchParams.get('theory')
  const fromCase = searchParams.get('fromCase')

  const setSortBy = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'popularity') next.set('sort', value)
    else next.delete('sort')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    fetch('/data/theories.json')
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (isDesktop && !theoryParam) {
          setExpandedTheories(new Set(d.theories.map(t => t.id)))
        }
      })
      .catch(err => console.error('Failed to load theories:', err))
  }, [])

  useEffect(() => {
    if (theoryParam && data) {
      setExpandedTheories(new Set([theoryParam]))
      setTimeout(() => {
        const el = document.getElementById(`theory-${theoryParam}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [theoryParam, data])

  const sortedTheories = useMemo(() => {
    if (!data) return []
    const t = [...data.theories]
    if (sortBy === 'popularity') t.sort((a, b) => b.popularity - a.popularity)
    else if (sortBy === 'scientific') t.sort((a, b) => b.scientific_support - a.scientific_support)
    else t.sort((a, b) => a.name.localeCompare(b.name))
    return t
  }, [data, sortBy])

  if (!data) return <Skeleton />

  const communitySources = Object.values(data.community_sources)

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <SectionSidebar theories={sortedTheories} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
          {/* Header */}
          {fromCase && (
            <Link
              to={`/cases?case=${encodeURIComponent(fromCase)}`}
              className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              <span>&larr;</span>
              <span>Back to Cases: {fromCase.replace(/_/g, ' ')}</span>
            </Link>
          )}
          <h1 className="text-xl font-bold text-slate-100 mb-2">The Legacy Program</h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-1">{data.overview}</p>
          <p className="text-xs text-slate-500 mb-6">
            Last updated {data.last_updated}
          </p>

          {/* Legacy Program Interactive Framework */}
          <section id="framework">
            <LegacyProgramChart />
          </section>

          {/* Navigation Hub */}
          <nav id="nav-hub" className="mt-8 flex flex-wrap gap-1.5 sm:gap-2">
            {[
              { to: '/documents', icon: '◫', label: 'Documents', color: 'text-blue-400 hover:border-blue-500/40' },
              { to: '/cases', icon: '◆', label: 'Cases', color: 'text-red-400 hover:border-red-500/40' },
              { to: '/timeline', icon: '━', label: 'Timeline', color: 'text-amber-400 hover:border-amber-500/40' },
              { to: '/graph', icon: '◈', label: 'Graph', color: 'text-indigo-400 hover:border-indigo-500/40' },
              { to: '/map', icon: '◎', label: 'Map', color: 'text-emerald-400 hover:border-emerald-500/40' },
              { to: '/entities', icon: '▣', label: 'Entities', color: 'text-amber-400 hover:border-amber-500/40' },
              { to: '/disclosure', icon: '%', label: 'Disclosure', color: 'text-purple-400 hover:border-purple-500/40' },
              { to: '/search', icon: '⌕', label: 'Search', color: 'text-slate-400 hover:border-slate-500/40' },
            ].map(n => (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800/60 transition-colors text-xs ${n.color}`}>
                <span>{n.icon}</span>
                <span className="text-slate-300">{n.label}</span>
              </Link>
            ))}
          </nav>

          {/* Theories Grid */}
          <section id="hypotheses" className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-200">Competing Hypotheses</h2>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-xs bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300"
              >
                <option value="popularity">Sort: Popularity</option>
                <option value="scientific">Sort: Scientific Support</option>
                <option value="name">Sort: A–Z</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTheories.map(t => (
                <div key={t.id} className={expandedTheories.has(t.id) ? 'sm:col-span-2 lg:col-span-3' : ''}>
                  <TheoryCard
                    theory={t}
                    isExpanded={expandedTheories.has(t.id)}
                    onToggle={() => setExpandedTheories(prev => {
                      const next = new Set(prev)
                      if (next.has(t.id)) next.delete(t.id)
                      else next.add(t.id)
                      return next
                    })}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Key Researchers */}
          <section id="researchers" className="mt-10">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Key Researchers</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.key_researchers.map((r, i) => (
                <ResearcherCard key={i} r={r} />
              ))}
            </div>
          </section>

          {/* Community Sources */}
          <section id="community" className="mt-10">
            <h2 className="text-lg font-bold text-slate-200 mb-2">Community Sources</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Vetted independent researchers, journalists, and organizations providing ongoing UAP investigation and analysis.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {communitySources.map((s, i) => (
                <CommunitySource key={i} source={s} />
              ))}
            </div>
          </section>
      </div>
    </div>
  )
}
