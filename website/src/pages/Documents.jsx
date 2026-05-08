import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocuments, agencyClass, formatDate } from '../hooks/useData'

const AGENCIES = ['Department of War', 'FBI', 'NASA', 'Department of State']
const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}
const DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']
const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (newest)' },
  { value: 'date-asc', label: 'Date (oldest)' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'pages-desc', label: 'Pages (most)' },
  { value: 'length-desc', label: 'Text length (longest)' },
]

function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-slate-700 rounded w-12" />
        <div className="h-5 bg-slate-700 rounded w-20" />
        <div className="h-5 bg-slate-700 rounded w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-700/60 rounded w-full" />
        <div className="h-3 bg-slate-700/60 rounded w-5/6" />
        <div className="h-3 bg-slate-700/60 rounded w-2/3" />
      </div>
    </div>
  )
}

export default function Documents() {
  const docs = useDocuments()
  const [searchParams, setSearchParams] = useSearchParams()

  const agency = searchParams.get('agency') || ''
  const decade = searchParams.get('decade') || ''
  const location = searchParams.get('location') || ''
  const sort = searchParams.get('sort') || 'date-desc'

  const locations = useMemo(() => {
    if (!docs) return []
    const set = new Set(docs.map(d => d.incident_location).filter(Boolean))
    return Array.from(set).sort()
  }, [docs])

  const filtered = useMemo(() => {
    if (!docs) return null
    let result = [...docs]

    if (agency) result = result.filter(d => d.agency === agency)
    if (decade) result = result.filter(d => d.decade === decade)
    if (location) result = result.filter(d => d.incident_location === location)

    const [field, dir] = sort.split('-')
    result.sort((a, b) => {
      let av, bv
      if (field === 'date') {
        av = a.incident_date_parsed || ''
        bv = b.incident_date_parsed || ''
      } else if (field === 'title') {
        av = (a.title || '').toLowerCase()
        bv = (b.title || '').toLowerCase()
      } else if (field === 'pages') {
        av = a.total_pages || 0
        bv = b.total_pages || 0
      } else if (field === 'length') {
        av = a.text_length || 0
        bv = b.text_length || 0
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [docs, agency, decade, location, sort])

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setSearchParams({}, { replace: true })
  }

  const hasFilters = agency || decade || location

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Declassified Documents</h1>
      <p className="text-sm text-slate-400 mb-5">
        Browse the full collection of UAP-related documents released by the U.S. government.
      </p>

      {/* Filter Bar */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Agency pills */}
          <div className="flex flex-wrap gap-1.5">
            {AGENCIES.map(a => (
              <button
                key={a}
                onClick={() => setFilter('agency', agency === a ? '' : a)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  agency === a
                    ? `agency-badge ${agencyClass(a)}`
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {AGENCY_SHORT[a]}
              </button>
            ))}
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Decade dropdown */}
          <select
            value={decade}
            onChange={e => setFilter('decade', e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary/50"
          >
            <option value="">All decades</option>
            {DECADES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Location dropdown */}
          <select
            value={location}
            onChange={e => setFilter('location', e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary/50"
          >
            <option value="">All locations</option>
            {locations.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={e => setFilter('sort', e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary/50"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {filtered && docs && (
        <p className="text-xs text-slate-500 mb-3">
          Showing {filtered.length} of {docs.length} documents
        </p>
      )}

      {/* Document list */}
      {!filtered ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-2">No documents match your filters.</p>
          <button onClick={clearFilters} className="text-primary text-sm hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(doc => (
            <Link
              key={doc.id}
              to={`/documents/${doc.id}`}
              className="block bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 hover:bg-slate-800/80 hover:translate-y-[-1px] hover:shadow-lg transition-all group"
            >
              <h2 className="text-sm font-semibold text-slate-200 group-hover:text-primary-light transition-colors mb-2 line-clamp-2">
                {doc.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className={`agency-badge ${agencyClass(doc.agency)}`}>
                  {AGENCY_SHORT[doc.agency] || doc.agency}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(doc.incident_date_parsed)}
                </span>
                {doc.incident_location && (
                  <span className="text-xs text-slate-500">{doc.incident_location}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mb-2.5">
                <span>{doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}</span>
                <span>{doc.text_length?.toLocaleString()} chars</span>
                {doc.has_redaction === 1 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    Redacted
                  </span>
                )}
                {doc.ocr_applied === 1 && (
                  <span className="text-amber-600">OCR</span>
                )}
              </div>
              {doc.excerpt && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {doc.excerpt}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
