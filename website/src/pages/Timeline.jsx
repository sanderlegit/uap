import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDocuments, agencyColor, agencyClass, formatDate } from '../hooks/useData'

const AGENCIES = [
  { key: 'Department of War', label: 'Dept. of War' },
  { key: 'FBI', label: 'FBI' },
  { key: 'NASA', label: 'NASA' },
  { key: 'Department of State', label: 'Dept. of State' },
]

const DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-4" />
        <div className="h-4 w-64 bg-slate-800/60 rounded animate-pulse mb-6" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-20 bg-slate-800 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 rounded-full bg-slate-800 animate-pulse mt-1.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                <div className="h-20 bg-slate-800/50 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Timeline() {
  const docs = useDocuments()
  const [selectedAgencies, setSelectedAgencies] = useState(new Set())
  const [selectedDecade, setSelectedDecade] = useState(null)

  const toggleAgency = (agency) => {
    setSelectedAgencies(prev => {
      const next = new Set(prev)
      if (next.has(agency)) next.delete(agency)
      else next.add(agency)
      return next
    })
  }

  const { grouped, datedCount, undatedCount } = useMemo(() => {
    if (!docs) return { grouped: [], datedCount: 0, undatedCount: 0 }

    let filtered = docs
    if (selectedAgencies.size > 0) {
      filtered = filtered.filter(d => selectedAgencies.has(d.agency))
    }
    if (selectedDecade) {
      filtered = filtered.filter(d => d.decade === selectedDecade)
    }

    const dated = []
    const undated = []

    filtered.forEach(doc => {
      if (doc.incident_date_parsed) {
        dated.push(doc)
      } else {
        undated.push(doc)
      }
    })

    dated.sort((a, b) => new Date(a.incident_date_parsed) - new Date(b.incident_date_parsed))

    const byYear = new Map()
    dated.forEach(doc => {
      const year = new Date(doc.incident_date_parsed).getFullYear()
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push(doc)
    })

    const groups = Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, docs]) => ({ year: String(year), docs }))

    if (undated.length > 0) {
      groups.push({ year: 'Unknown Date', docs: undated })
    }

    return { grouped: groups, datedCount: dated.length, undatedCount: undated.length }
  }, [docs, selectedAgencies, selectedDecade])

  if (!docs) return <Skeleton />

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <h1 className="text-xl font-bold text-slate-100 mb-1">Timeline</h1>
        <p className="text-sm text-slate-400 mb-5">
          {datedCount} document{datedCount !== 1 ? 's' : ''} with dates, {undatedCount} undated
        </p>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Agency pills */}
          <div className="flex flex-wrap gap-2">
            {AGENCIES.map(a => {
              const active = selectedAgencies.has(a.key)
              return (
                <button
                  key={a.key}
                  onClick={() => toggleAgency(a.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? 'border-transparent text-white'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                  style={active ? { backgroundColor: agencyColor(a.key), borderColor: agencyColor(a.key) } : undefined}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
          {/* Decade filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedDecade(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                !selectedDecade
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              All decades
            </button>
            {DECADES.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDecade(selectedDecade === d ? null : d)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  selectedDecade === d
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">No documents match these filters.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-800" />

            {grouped.map(group => (
              <div key={group.year} className="mb-8">
                {/* Year header */}
                <div className="sticky top-14 z-10 mb-3">
                  <div className="inline-flex items-center gap-2 bg-slate-950/95 backdrop-blur pr-4 py-1">
                    <div className="w-[15px] h-[15px] rounded-full bg-slate-700 border-2 border-slate-950 flex-shrink-0 relative z-10" />
                    <h2 className="text-sm font-bold text-slate-200 tracking-wide">
                      {group.year}
                    </h2>
                    <span className="text-xs text-slate-500">
                      ({group.docs.length})
                    </span>
                  </div>
                </div>

                {/* Document cards */}
                <div className="space-y-2 pl-8">
                  {group.docs.map(doc => (
                    <Link
                      key={doc.id}
                      to={`/documents/${doc.id}`}
                      className="block bg-slate-900 border border-slate-700/50 rounded-lg p-3 hover:border-blue-500/40 hover:bg-slate-800/80 transition-colors relative"
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[23.5px] top-4 w-[9px] h-[9px] rounded-full border-2 border-slate-950"
                        style={{ backgroundColor: agencyColor(doc.agency) }}
                      />

                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-sm font-medium text-slate-200 leading-snug line-clamp-2 flex-1">
                          {doc.title}
                        </h3>
                        {doc.has_redaction && (
                          <span className="flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Redacted
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {doc.agency && (
                          <span className={`agency-badge ${agencyClass(doc.agency)}`}>
                            {doc.agency}
                          </span>
                        )}
                        {doc.incident_date_parsed && (
                          <span className="text-slate-500">{formatDate(doc.incident_date_parsed)}</span>
                        )}
                        {doc.incident_location && (
                          <span className="text-slate-500 truncate max-w-[200px]">{doc.incident_location}</span>
                        )}
                      </div>

                      {doc.behaviors && doc.behaviors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.behaviors.slice(0, 5).map(b => (
                            <span
                              key={b}
                              className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
                            >
                              {b}
                            </span>
                          ))}
                          {doc.behaviors.length > 5 && (
                            <span className="text-[10px] text-slate-600">
                              +{doc.behaviors.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
