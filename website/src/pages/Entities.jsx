import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEntities, useDocuments, agencyColor, formatDate } from '../hooks/useData'
import { useExplorationTrail } from '../hooks/useExplorationTrail'

const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}

const TYPE_COLORS = {
  organization: '#60a5fa',
  person: '#fbbf24',
  location: '#4ade80',
  case_number: '#94a3b8',
}

const SORT_OPTIONS = [
  { value: 'docs', label: 'Most documents' },
  { value: 'alpha', label: 'Alphabetical' },
]

function typeColor(type) {
  return TYPE_COLORS[type] || '#94a3b8'
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 animate-pulse">
      <div className="h-5 bg-slate-700 rounded w-1/2 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-slate-700 rounded w-16" />
        <div className="h-5 bg-slate-700 rounded w-24" />
      </div>
      <div className="h-3 bg-slate-700/60 rounded w-1/3" />
    </div>
  )
}

function EntityCard({ entity, docs }) {
  const [expanded, setExpanded] = useState(false)
  const { addToTrail } = useExplorationTrail()
  const color = typeColor(entity.type)
  const decades = entity.decades.filter(d => d !== 'Unknown').sort()
  const decadeRange = decades.length > 0
    ? decades.length === 1 ? decades[0] : `${decades[0]} - ${decades[decades.length - 1]}`
    : null

  const linkedDocs = useMemo(() => {
    if (!expanded || !docs) return []
    return entity.doc_ids
      .map(id => docs.find(d => d.id === id))
      .filter(Boolean)
      .sort((a, b) => (b.incident_date_parsed || '').localeCompare(a.incident_date_parsed || ''))
  }, [expanded, docs, entity.doc_ids])

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600 transition-all">
      <button
        onClick={() => {
          const next = !expanded
          setExpanded(next)
          if (next) {
            addToTrail({ type: 'entity', id: entity.name, title: entity.name, path: '/entities?q=' + encodeURIComponent(entity.name) })
          }
        }}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200 mb-2">{entity.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {entity.type}
              </span>
              <span className="text-xs text-slate-400">
                {entity.doc_count} {entity.doc_count === 1 ? 'document' : 'documents'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {entity.agencies.map(a => (
                  <span
                    key={a}
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: agencyColor(a) }}
                    title={a}
                  />
                ))}
              </div>
              {decadeRange && (
                <span className="text-[11px] text-slate-500">{decadeRange}</span>
              )}
            </div>
          </div>
          <span className={`text-slate-500 text-xs mt-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <Link
              to={`/graph?search=${encodeURIComponent(entity.name)}`}
              className="px-2.5 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              View on Graph
            </Link>
            {decades.length > 0 && (
              <Link
                to={`/timeline?decade=${decades[0]}`}
                className="px-2.5 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                View on Timeline
              </Link>
            )}
          </div>

          <div className="mb-2">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
              Mentioned in {entity.doc_count} documents
            </span>
          </div>

          {!docs ? (
            <div className="text-xs text-slate-500">Loading documents...</div>
          ) : (
            <div className="space-y-1">
              {linkedDocs.map(doc => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-slate-700/30 transition-colors group"
                >
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
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
                  {doc.incident_date_parsed && (
                    <span className="text-[10px] text-slate-500 shrink-0 ml-auto">
                      {formatDate(doc.incident_date_parsed)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Entities() {
  const entities = useEntities()
  const docs = useDocuments()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') || ''
  const type = searchParams.get('type') || ''
  const sort = searchParams.get('sort') || 'docs'

  const types = useMemo(() => {
    if (!entities) return []
    const set = new Set(entities.map(e => e.type))
    return Array.from(set).sort()
  }, [entities])

  const filtered = useMemo(() => {
    if (!entities) return null
    let result = [...entities]

    if (q) {
      const lower = q.toLowerCase()
      result = result.filter(e => e.name.toLowerCase().includes(lower))
    }

    if (type) {
      result = result.filter(e => e.type === type)
    }

    if (sort === 'alpha') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      result.sort((a, b) => b.doc_count - a.doc_count)
    }

    return result
  }, [entities, q, type, sort])

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

  const hasFilters = q || type

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Entities</h1>
      <p className="text-sm text-slate-400 mb-5">
        Investigate by organization, person, or location across all declassified documents.
      </p>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={q}
            onChange={e => setFilter('q', e.target.value)}
            placeholder="Search entities..."
            className="bg-slate-700/50 border border-slate-600/50 text-slate-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-primary/50 w-48 placeholder-slate-500"
          />

          <span className="text-slate-600 hidden sm:inline">|</span>

          <div className="flex flex-wrap gap-1.5">
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter('type', type === t ? '' : t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  type === t
                    ? 'text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
                style={type === t ? { backgroundColor: `${typeColor(t)}30`, color: typeColor(t) } : undefined}
              >
                {t}
              </button>
            ))}
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

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

      {filtered && entities && (
        <p className="text-xs text-slate-500 mb-3">
          Showing {filtered.length} of {entities.length} entities
        </p>
      )}

      {!filtered ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-2">No entities match your filters.</p>
          <button onClick={clearFilters} className="text-primary text-sm hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(entity => (
            <EntityCard key={entity.name} entity={entity} docs={docs} />
          ))}
        </div>
      )}
    </div>
  )
}
