import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSearch, agencyClass, formatDate } from '../hooks/useData'

const agencies = ['Department of War', 'FBI', 'NASA', 'Department of State']
const agencyLabels = { 'Department of War': 'DoW', 'FBI': 'FBI', 'NASA': 'NASA', 'Department of State': 'DoS' }
const decades = ['1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'Unknown']
const suggestions = ['radar', 'flying disc', 'Apollo', 'Syria', 'range fouler', 'luminosity', 'redacted']

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Building search index...</p>
      </div>
    </div>
  )
}

function getSnippet(text, query) {
  if (!text || !query) return null
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return null
  const start = Math.max(0, idx - 100)
  const end = Math.min(text.length, idx + query.length + 100)
  const before = (start > 0 ? '...' : '') + text.slice(start, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length, end) + (end < text.length ? '...' : '')
  return { before, match, after }
}

export default function Search() {
  const { ready, search } = useSearch()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeAgencies, setActiveAgencies] = useState(new Set())
  const [activeDecades, setActiveDecades] = useState(new Set())
  const inputRef = useRef(null)

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [ready])

  // Debounce query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const toggleAgency = (a) => {
    setActiveAgencies(prev => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  const toggleDecade = (d) => {
    setActiveDecades(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    let hits = search(debouncedQuery.trim(), 100)
    if (activeAgencies.size > 0) {
      hits = hits.filter(r => activeAgencies.has(r.agency))
    }
    if (activeDecades.size > 0) {
      hits = hits.filter(r => activeDecades.has(r.decade))
    }
    return hits
  }, [debouncedQuery, search, activeAgencies, activeDecades])

  if (!ready) return <Spinner />

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-10">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 129 declassified documents..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-slate-100 text-base placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Agency:</span>
          {agencies.map(a => (
            <button
              key={a}
              onClick={() => toggleAgency(a)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeAgencies.has(a)
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {agencyLabels[a]}
            </button>
          ))}
          <span className="text-xs text-slate-500 self-center mr-1 ml-2">Decade:</span>
          {decades.map(d => (
            <button
              key={d}
              onClick={() => toggleDecade(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeDecades.has(d)
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Results / Suggestions */}
        <div className="mt-6">
          {!hasQuery ? (
            /* Suggestion chips */
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm mb-4">Try searching for:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); inputRef.current?.focus() }}
                    className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-full text-sm text-slate-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            /* Empty state */
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No documents match your search</p>
            </div>
          ) : (
            <>
              {/* Result count */}
              <p className="text-sm text-slate-400 mb-4">
                Found <span className="text-slate-200 font-medium">{results.length}</span> result{results.length !== 1 ? 's' : ''} for{' '}
                <span className="text-blue-400">'{debouncedQuery.trim()}'</span>
              </p>

              {/* Result cards */}
              <div className="flex flex-col gap-3">
                {results.map(r => {
                  const snippet = getSnippet(r.text, debouncedQuery.trim())
                  return (
                    <Link
                      key={r.id}
                      to={`/documents/${r.id}`}
                      className="bg-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-blue-500/40 hover:bg-slate-800/80 transition-colors block"
                    >
                      <h3 className="text-sm font-medium text-slate-200 leading-snug line-clamp-2 mb-2">
                        {r.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                        {r.agency && (
                          <span className={`agency-badge ${agencyClass(r.agency)}`}>
                            {r.agency}
                          </span>
                        )}
                        {r.date && (
                          <span className="text-slate-500">{formatDate(r.date)}</span>
                        )}
                        {r.location && (
                          <span className="text-slate-500">{r.location}</span>
                        )}
                      </div>
                      {snippet && (
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                          {snippet.before}
                          <mark className="bg-amber-500/30 text-amber-200">{snippet.match}</mark>
                          {snippet.after}
                        </p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
