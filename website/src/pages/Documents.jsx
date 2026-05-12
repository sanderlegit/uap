import { useMemo, useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocuments, agencyClass, formatDate } from '../hooks/useData'
import DocThumbnail from '../components/DocThumbnail'
import VocabBadge from '../components/VocabBadge'
import useDocPrefs from '../hooks/useDocPrefs'

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

const PAGE_SIZE = 30

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
  const [narratives, setNarratives] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isRead, isStarred, isSuggested, toggleStar, starredIds } = useDocPrefs()

  useEffect(() => {
    fetch('/data/doc_narratives.json')
      .then(r => r.json())
      .then(setNarratives)
      .catch(() => {})
  }, [])

  const agency = searchParams.get('agency') || ''
  const decade = searchParams.get('decade') || ''
  const location = searchParams.get('location') || ''
  const sort = searchParams.get('sort') || 'date-desc'
  const showStarred = searchParams.get('starred') === '1'

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
    if (showStarred) result = result.filter(d => starredIds.has(d.id))

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
  }, [docs, agency, decade, location, sort, showStarred, starredIds])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [agency, decade, location, sort])

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

  const hasFilters = agency || decade || location || showStarred

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef(null)
  const observerRef = useRef(null)

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!loadMoreRef.current || !filtered || visibleCount >= filtered.length) return

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(v => Math.min(v + PAGE_SIZE, filtered.length))
      }
    }, { rootMargin: '200px' })
    observerRef.current.observe(loadMoreRef.current)

    return () => observerRef.current?.disconnect()
  }, [filtered, visibleCount])

  const visibleDocs = filtered?.slice(0, visibleCount)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Declassified Documents</h1>
      <p className="text-sm text-slate-400 mb-5">
        Browse the full collection of UAP-related documents released by the U.S. government.
      </p>

      {/* Filter Bar — sticky on scroll */}
      <div className="sticky top-0 md:top-14 z-30 -mx-4 px-4 py-2 bg-slate-950/90 backdrop-blur-sm mb-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          {/* Row 1: Agency pills + starred filter */}
          <div className="flex items-center gap-2 mb-2 sm:mb-0 sm:inline-flex">
            {AGENCIES.map(a => (
              <button
                key={a}
                onClick={() => setFilter('agency', agency === a ? '' : a)}
                className={`px-3 py-2 rounded text-xs font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:py-1.5 ${
                  agency === a
                    ? `agency-badge ${agencyClass(a)}`
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {AGENCY_SHORT[a]}
              </button>
            ))}
            <button
              onClick={() => setFilter('starred', showStarred ? '' : '1')}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 sm:min-h-0 sm:py-1.5 cursor-pointer ${
                showStarred
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {starredIds.size > 0 && <span>{starredIds.size}</span>}
            </button>
          </div>

          {/* Row 2: Dropdowns + clear */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={decade}
              onChange={e => setFilter('decade', e.target.value)}
              className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 focus:outline-none focus:border-primary/50 flex-1 sm:flex-none"
            >
              <option value="">All decades</option>
              {DECADES.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={location}
              onChange={e => setFilter('location', e.target.value)}
              className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 focus:outline-none focus:border-primary/50 flex-1 sm:flex-none"
            >
              <option value="">All locations</option>
              {locations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={e => setFilter('sort', e.target.value)}
              className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded px-2.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 focus:outline-none focus:border-primary/50 flex-1 sm:flex-none"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1 rounded bg-slate-700/30 sm:bg-transparent"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Result count — higher contrast */}
        {filtered && docs && (
          <p className="text-xs text-slate-400 mt-2">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} documents
            {hasFilters && <span className="text-slate-500"> (filtered from {docs.length})</span>}
          </p>
        )}
      </div>

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
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {visibleDocs.map(doc => {
              const read = isRead(doc.id)
              const starred = isStarred(doc.id)
              const suggested = isSuggested(doc.id)
              return (
                <div key={doc.id} className="relative">
                  <Link
                    to={`/documents/${doc.id}`}
                    className={`flex gap-3 sm:gap-4 border rounded-lg p-3 sm:p-4 hover:translate-y-[-1px] hover:shadow-lg transition-all group ${
                      read
                        ? 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/60 hover:bg-slate-800/50'
                        : suggested
                          ? 'bg-slate-800/60 border-amber-500/20 hover:border-amber-500/40 hover:bg-slate-800/80'
                          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                  >
                    <DocThumbnail docId={doc.id} size={doc.total_pages === 1 ? 'cover' : 'md'} className="hidden sm:block" />
                    <div className="min-w-0 flex-1 pr-7">
                      <h2 className={`text-sm font-semibold group-hover:text-primary-light transition-colors mb-2 line-clamp-2 ${read ? 'text-slate-400' : 'text-slate-200'}`}>
                        {doc.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`agency-badge ${agencyClass(doc.agency)}`}>
                          {AGENCY_SHORT[doc.agency] || doc.agency}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(doc.incident_date_parsed)}
                        </span>
                        {doc.incident_location && (
                          <span className="text-xs text-slate-500">{doc.incident_location}</span>
                        )}
                        {suggested && !read && (
                          <span className="text-[10px] font-mono tracking-wider uppercase text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Featured</span>
                        )}
                        {read && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-600">
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Read
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
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
                        <VocabBadge docId={doc.id} />
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 sm:line-clamp-3 ${read ? 'text-slate-500' : 'text-slate-400'}`}>
                        {narratives?.[String(doc.id)]?.hook || doc.excerpt || ''}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStar(doc.id) }}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-700/50 transition-colors cursor-pointer z-10 group/star"
                    title={starred ? 'Remove from starred' : 'Star this document'}
                  >
                    {starred ? (
                      <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-600 group-hover/star:text-amber-400/60 transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Load more trigger */}
          {visibleCount < filtered.length && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              <button
                onClick={() => setVisibleCount(v => Math.min(v + PAGE_SIZE, filtered.length))}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-4 py-2 rounded border border-slate-700 hover:border-slate-600"
              >
                Show more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
