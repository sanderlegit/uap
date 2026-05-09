import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const CATEGORY_COLORS = {
  military_encounter: '#3b82f6',
  retrieval: '#ef4444',
  mass_sighting: '#f59e0b',
  close_encounter: '#8b5cf6',
  historical_military: '#6b7280',
  space_encounter: '#06b6d4',
  government_disclosure: '#10b981',
}

const CASE_DOC_IDS = {
  foo_fighters_1944: [64],
  apollo_sightings: [103, 55, 106, 101, 102, 104, 105, 50, 51, 52, 53, 54],
  washington_dc_1952: [68, 69, 70],
}

function CaseCard({ c, categories, isExpanded, onToggle }) {
  const cat = categories[c.category] || {}
  const color = CATEGORY_COLORS[c.category] || '#6b7280'

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600/80 hover:translate-y-[-1px] hover:shadow-lg transition-all">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {cat.icon || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-sm font-semibold text-slate-200 leading-snug">{c.name}</h3>
              <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>{c.year}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: `${color}40`, color, backgroundColor: `${color}08` }}>
                {cat.label}
              </span>
              <span className="text-[10px] text-slate-500">{c.location}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{c.summary}</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{c.detail}</p>

          <div>
            <h4 className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider mb-1.5">Why High-Validity</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">{c.validity}</p>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Evidence Types</h4>
            <div className="flex flex-wrap gap-1.5">
              {c.evidence_types.map((e, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/30">
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Key Figures</h4>
            <div className="flex flex-wrap gap-1.5">
              {c.key_figures.map((f, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {CASE_DOC_IDS[c.id] && (
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-[10px] font-bold text-blue-400/70 uppercase tracking-wider mb-1.5">PURSUE Documents</h4>
              <p className="text-[10px] text-slate-500 mb-2">Declassified documents from this collection related to this case:</p>
              <div className="flex flex-wrap gap-1.5">
                {CASE_DOC_IDS[c.id].slice(0, 6).map(docId => (
                  <Link
                    key={docId}
                    to={`/documents/${docId}`}
                    className="text-[11px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30 transition-colors"
                  >
                    Doc #{docId} →
                  </Link>
                ))}
                {CASE_DOC_IDS[c.id].length > 6 && (
                  <Link
                    to={`/search?q=${encodeURIComponent(c.name)}`}
                    className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    +{CASE_DOC_IDS[c.id].length - 6} more
                  </Link>
                )}
              </div>
            </div>
          )}

          {c.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sources</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {c.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800">
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/graph?search=${encodeURIComponent(c.name.split(/[\s:,]+/).find(w => w.length > 3 && !/^(the|and|over|from|with|near)$/i.test(w)) || c.name.split(/\s+/)[0])}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View on Graph →
              </Link>
              <Link
                to={`/timeline?decade=${Math.floor(c.year / 10) * 10}s`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View on Timeline →
              </Link>
              <Link
                to="/theories"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Related Theories →
              </Link>
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
      <div className="max-w-3xl mx-auto px-4 pt-10 space-y-4">
        <div className="h-6 w-48 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-800/40 rounded animate-pulse" />
        <div className="grid gap-4 mt-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Cases() {
  const [data, setData] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedCase, setExpandedCase] = useState(null)

  const filter = searchParams.get('category') || 'all'
  const sortBy = searchParams.get('sort') || 'year_desc'

  const setFilter = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'all') next.set('category', value)
    else next.delete('category')
    setSearchParams(next, { replace: true })
  }

  const setSortBy = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'year_desc') next.set('sort', value)
    else next.delete('sort')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    fetch('/data/cases.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load cases:', err))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    let cases = [...data.cases]
    if (filter !== 'all') cases = cases.filter(c => c.category === filter)
    if (sortBy === 'year_desc') cases.sort((a, b) => b.year - a.year)
    else if (sortBy === 'year_asc') cases.sort((a, b) => a.year - b.year)
    else cases.sort((a, b) => a.name.localeCompare(b.name))
    return cases
  }, [data, filter, sortBy])

  if (!data) return <Skeleton />

  const categoryEntries = Object.entries(data.categories)

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 sm:pt-12">
        <h1 className="text-xl font-bold text-slate-100 mb-2">High-Validity UAP Cases</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">{data.overview}</p>
        <p className="text-xs text-slate-500 mb-6">
          {data.cases.length} cases &middot; Last updated {data.last_updated} &middot;{' '}
          <Link to="/" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Dashboard</Link>
          {' '}&middot;{' '}
          <Link to="/theories" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Theories</Link>
          {' '}&middot;{' '}
          <Link to="/documents" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">All Documents</Link>
          {' '}&middot;{' '}
          <Link to="/timeline" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Timeline</Link>
        </p>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors ${
              filter === 'all'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-slate-700/40 text-slate-500 hover:text-slate-300'
            }`}
          >
            All ({data.cases.length})
          </button>
          {categoryEntries.map(([key, cat]) => {
            const count = data.cases.filter(c => c.category === key).length
            if (count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? 'all' : key)}
                className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors ${
                  filter === key
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat.icon} {cat.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] text-slate-500">{filtered.length} cases</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
          >
            <option value="year_desc">Newest First</option>
            <option value="year_asc">Oldest First</option>
            <option value="name">A–Z</option>
          </select>
        </div>

        {/* Case cards */}
        <div className="space-y-3">
          {filtered.map(c => (
            <CaseCard
              key={c.id}
              c={c}
              categories={data.categories}
              isExpanded={expandedCase === c.id}
              onToggle={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
