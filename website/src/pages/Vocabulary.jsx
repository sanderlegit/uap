import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVocabulary, useDocuments, agencyColor } from '../hooks/useData'

const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}

const SORT_OPTIONS = [
  { value: 'freq', label: 'Most frequent' },
  { value: 'loading', label: 'Most loaded' },
  { value: 'alpha', label: 'Alphabetical' },
  { value: 'docs', label: 'Most documents' },
]

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'original', label: 'Government docs' },
  { value: 'editorial', label: 'Editorial layer' },
  { value: 'both', label: 'Both layers' },
]

function LoadingBar({ level }) {
  const colors = ['#22c55e', '#eab308', '#f97316', '#ef4444']
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-sm"
          style={{
            backgroundColor: i <= level ? colors[i - 1] : 'rgba(100,116,139,0.15)',
          }}
        />
      ))}
    </div>
  )
}

function LoadingBadge({ level, scale }) {
  if (!scale) return null
  const info = scale[String(level)]
  if (!info) return null
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${info.color}20`, color: info.color }}
    >
      {info.label}
    </span>
  )
}

function TermTimeline({ timeline }) {
  if (!timeline) return null
  return (
    <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 overflow-x-auto">
      <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-500 mb-3">
        Terminology Evolution
      </h2>
      <div className="relative min-w-max flex items-start gap-0">
        <div className="absolute left-0 right-0 top-[18px] h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
        {timeline.map((era, i) => (
          <div key={era.era} className="relative flex-1 min-w-[160px] px-3">
            <div className="w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500 mx-auto mb-3 relative z-10" />
            <div className="text-center mb-2">
              <div className="text-xs font-semibold text-slate-200">{era.label}</div>
              <div className="text-[10px] text-slate-500">{era.years}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              {era.dominant_terms.map(t => (
                <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/20">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">{era.worldview_note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TermCard({ term, scale, docs, allDocs }) {
  const [expanded, setExpanded] = useState(false)

  const linkedDocs = useMemo(() => {
    if (!expanded || !allDocs) return []
    return (term.doc_ids || [])
      .map(id => allDocs.find(d => d.id === id))
      .filter(Boolean)
      .sort((a, b) => (term.doc_counts?.[b.id] || 0) - (term.doc_counts?.[a.id] || 0))
  }, [expanded, allDocs, term])

  const loadInfo = scale?.[String(term.loading)]
  const absent = term.total_count === 0

  return (
    <div className={`bg-slate-800/60 border rounded-lg overflow-hidden transition-all ${
      absent ? 'border-slate-700/30 opacity-60' : 'border-slate-700/50 hover:border-slate-600'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-slate-200">{term.term}</h2>
              {absent && (
                <span className="text-[10px] text-slate-600 italic">absent from corpus</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <LoadingBar level={term.loading} />
              <LoadingBadge level={term.loading} scale={scale} />
              <span className="text-[10px] text-slate-500 font-mono">{term.era}</span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{
                  backgroundColor: term.source === 'original' ? 'rgba(34,197,94,0.15)' : term.source === 'editorial' ? 'rgba(234,179,8,0.15)' : 'rgba(100,116,139,0.15)',
                  color: term.source === 'original' ? '#22c55e' : term.source === 'editorial' ? '#eab308' : '#94a3b8',
                }}
              >
                {term.source === 'original' ? 'GOV' : term.source === 'editorial' ? 'EDIT' : 'BOTH'}
              </span>
            </div>
            {!absent && (
              <div className="text-[11px] text-slate-500">
                {term.total_count} mentions in {term.doc_count} documents
              </div>
            )}
          </div>
          <span className={`text-slate-500 text-xs mt-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3">
          <p className="text-xs text-slate-300 leading-relaxed mb-3">{term.definition}</p>

          {term.worldview && term.worldview !== 'neutral' && (
            <div className="mb-3">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">Signal: </span>
              <span className="text-[11px] text-slate-400">
                {term.worldview === 'mild_assumption' && 'Carries subtle assumptions about the phenomenon'}
                {term.worldview === 'community' && 'Signals familiarity with the UAP community'}
                {term.worldview === 'loaded' && 'Signals a specific interpretive framework'}
                {term.worldview === 'shibboleth' && 'Tribal identity marker — places the speaker on the community map'}
                {term.worldview === 'institutional' && 'Government/military institutional framing'}
                {term.worldview === 'historical' && 'Era-specific historical term'}
              </span>
            </div>
          )}

          {linkedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-1.5">
                Appears in {term.doc_count} documents
              </span>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {linkedDocs.slice(0, 15).map(doc => (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}?search=${encodeURIComponent(term.term)}`}
                    className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-slate-700/30 transition-colors group"
                  >
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: `${agencyColor(doc.agency)}20`,
                        color: agencyColor(doc.agency),
                      }}
                    >
                      {AGENCY_SHORT[doc.agency] || doc.agency}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-1 min-w-0">
                      {doc.title}
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0 ml-auto font-mono">
                      {term.doc_counts?.[doc.id]}x
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {term.related_terms && term.related_terms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-500 mr-1">Related:</span>
              {term.related_terms.map(rt => (
                <span key={rt} className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                  {rt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 animate-pulse">
      <div className="h-5 bg-slate-700 rounded w-1/3 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-4 bg-slate-700 rounded w-16" />
        <div className="h-4 bg-slate-700 rounded w-20" />
      </div>
      <div className="h-3 bg-slate-700/60 rounded w-1/2" />
    </div>
  )
}

export default function Vocabulary() {
  const vocab = useVocabulary()
  const allDocs = useDocuments()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') || ''
  const cat = searchParams.get('cat') || ''
  const loading = searchParams.get('loading') || ''
  const source = searchParams.get('source') || ''
  const sort = searchParams.get('sort') || 'freq'

  const filtered = useMemo(() => {
    if (!vocab) return null
    let terms = [...vocab.terms]

    if (q) {
      const lower = q.toLowerCase()
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(lower) ||
        t.definition.toLowerCase().includes(lower)
      )
    }
    if (cat) terms = terms.filter(t => t.category === cat)
    if (loading) terms = terms.filter(t => t.loading === parseInt(loading))
    if (source) terms = terms.filter(t => t.source === source)

    if (sort === 'alpha') terms.sort((a, b) => a.term.localeCompare(b.term))
    else if (sort === 'loading') terms.sort((a, b) => b.loading - a.loading || b.total_count - a.total_count)
    else if (sort === 'docs') terms.sort((a, b) => b.doc_count - a.doc_count || b.total_count - a.total_count)
    else terms.sort((a, b) => b.total_count - a.total_count)

    return terms
  }, [vocab, q, cat, loading, source, sort])

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setSearchParams({}, { replace: true })
  }

  const hasFilters = q || cat || loading || source

  const stats = useMemo(() => {
    if (!vocab) return null
    const terms = vocab.terms
    return {
      total: terms.length,
      inCorpus: terms.filter(t => t.total_count > 0).length,
      absent: terms.filter(t => t.total_count === 0).length,
      byLoading: [1, 2, 3, 4].map(l => terms.filter(t => t.loading === l).length),
      govOnly: terms.filter(t => t.source === 'original' && t.total_count > 0).length,
      editOnly: terms.filter(t => t.source === 'editorial' && t.total_count > 0).length,
    }
  }, [vocab])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Vocabulary Analysis</h1>
      <p className="text-sm text-slate-400 mb-5">
        Every word is a worldview. This lexicon maps the loaded vocabulary of UAP discourse across {vocab?.meta?.total_pages?.toLocaleString() || '...'} pages.
      </p>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-200">{stats.total}</div>
            <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Terms tracked</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-400">{stats.inCorpus}</div>
            <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Found in docs</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{stats.govOnly}</div>
            <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Gov originals</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-400">{stats.byLoading[2] + stats.byLoading[3]}</div>
            <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Loaded terms</div>
          </div>
        </div>
      )}

      {vocab && <TermTimeline timeline={vocab.timeline} />}

      {/* Loading scale legend */}
      {vocab && (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 mb-5">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {Object.entries(vocab.loading_scale).map(([level, info]) => (
              <button
                key={level}
                onClick={() => setFilter('loading', loading === level ? '' : level)}
                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors cursor-pointer ${
                  loading === level ? 'bg-slate-700/60 ring-1 ring-slate-500' : 'hover:bg-slate-800/60'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: info.color }} />
                <span className="text-[11px] text-slate-300">{info.label}</span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">{info.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={q}
            onChange={e => setFilter('q', e.target.value)}
            placeholder="Search terms..."
            className="bg-slate-700/50 border border-slate-600/50 text-slate-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-blue-500/50 w-48 placeholder-slate-500"
          />

          <span className="text-slate-600 hidden sm:inline">|</span>

          <div className="flex flex-wrap gap-1.5">
            {vocab?.categories?.map(c => (
              <button
                key={c.id}
                onClick={() => setFilter('cat', cat === c.id ? '' : c.id)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  cat === c.id ? 'text-white' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
                style={cat === c.id ? { backgroundColor: `${c.color}30`, color: c.color } : undefined}
                title={c.description}
              >
                {c.label.length > 12 ? c.label.split(' ')[0] : c.label}
              </button>
            ))}
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          <select
            value={source}
            onChange={e => setFilter('source', e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none"
          >
            {SOURCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={e => setFilter('sort', e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered && vocab && (
        <p className="text-xs text-slate-500 mb-3">
          Showing {filtered.length} of {vocab.terms.length} terms
          {cat && vocab.categories && (
            <span> in <span className="text-slate-400">{vocab.categories.find(c => c.id === cat)?.label}</span></span>
          )}
        </p>
      )}

      {!filtered ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-2">No terms match your filters.</p>
          <button onClick={clearFilters} className="text-blue-400 text-sm hover:underline cursor-pointer">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(term => (
            <TermCard
              key={term.term}
              term={term}
              scale={vocab.loading_scale}
              allDocs={allDocs}
            />
          ))}
        </div>
      )}
    </div>
  )
}
