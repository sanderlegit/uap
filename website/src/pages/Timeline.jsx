import { useState, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDocuments, agencyColor, agencyClass, formatDate } from '../hooks/useData'

const AGENCIES = [
  { key: 'Department of War', label: 'Dept. of War' },
  { key: 'FBI', label: 'FBI' },
  { key: 'NASA', label: 'NASA' },
  { key: 'Department of State', label: 'Dept. of State' },
]

const DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']

const YEAR_CONTEXT = {
  '1944': 'WWII "foo fighters" reported',
  '1947': 'Roswell incident; first modern UFO reports',
  '1952': 'Washington D.C. UFO wave',
  '1969': 'Apollo 11 crew observations; Project Blue Book ends',
  '2017': 'NYT reveals Pentagon UFO program',
  '2024': 'AARO expands; UAPDA legislation',
  '2026': 'PURSUE files released',
}

const EVENT_ICONS = {
  'roswell': '🛸',
  'foo fighter': '✦',
  'majestic': '🔺',
  'blue book': '📘',
  'apollo': '🌙',
  'rendlesham': '🌲',
  'phoenix': '💡',
  'tic tac': '⬮',
  'gimbal': '🎯',
  'nimitz': '⚓',
  'socorro': '🔥',
  'mantell': '✈',
  'tehran': '⚡',
  'belgium': '▲',
}

function getIcon(title) {
  const t = title.toLowerCase()
  for (const [k, v] of Object.entries(EVENT_ICONS)) {
    if (t.includes(k)) return v
  }
  return null
}

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh">
      <div className="px-4 pt-6">
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-3" />
        <div className="h-4 w-64 bg-slate-800/60 rounded animate-pulse mb-5" />
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-20 bg-slate-800 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="h-[400px] bg-slate-900/30 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

export default function Timeline() {
  const docs = useDocuments()
  const [selectedAgencies, setSelectedAgencies] = useState(new Set())
  const [selectedDoc, setSelectedDoc] = useState(null)
  const yearRefs = useRef({})

  const toggleAgency = (agency) => {
    setSelectedAgencies(prev => {
      const next = new Set(prev)
      if (next.has(agency)) next.delete(agency)
      else next.add(agency)
      return next
    })
  }

  const scrollToDecade = useCallback((decade) => {
    const startYear = parseInt(decade)
    const keys = Object.keys(yearRefs.current).filter(k => k !== 'Undated').map(Number).sort((a, b) => a - b)
    const target = keys.find(y => y >= startYear)
    if (target && yearRefs.current[target]) {
      yearRefs.current[target].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
  }, [])

  const { grouped, datedCount, undatedCount } = useMemo(() => {
    if (!docs) return { grouped: [], datedCount: 0, undatedCount: 0 }

    let filtered = docs
    if (selectedAgencies.size > 0) {
      filtered = filtered.filter(d => selectedAgencies.has(d.agency))
    }

    const dated = []
    const undated = []
    filtered.forEach(doc => {
      if (doc.incident_date_parsed) dated.push(doc)
      else undated.push(doc)
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
      .map(([year, d]) => ({ year: String(year), docs: d }))

    if (undated.length > 0) {
      groups.push({ year: 'Undated', docs: undated })
    }

    return { grouped: groups, datedCount: dated.length, undatedCount: undated.length }
  }, [docs, selectedAgencies])

  if (!docs) return <Skeleton />

  return (
    <div className="bg-slate-950 min-h-dvh">
      {/* Header & Filters */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-100 mb-1">Timeline</h1>
        <p className="text-sm text-slate-400 mb-1">
          {datedCount} dated, {undatedCount} undated
          <span className="ml-2 text-xs text-slate-500">&larr; Scroll horizontally to explore &rarr;</span>
        </p>
        <p className="text-xs text-slate-500 mb-4">
          <Link to="/documents" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">All Documents</Link>
          {' '}&middot;{' '}
          <Link to="/graph" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Network Graph</Link>
          {' '}&middot;{' '}
          <Link to="/map" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Map</Link>
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {AGENCIES.map(a => {
            const active = selectedAgencies.has(a.key)
            return (
              <button
                key={a.key}
                onClick={() => toggleAgency(a.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  active ? 'border-transparent text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
                style={active ? { backgroundColor: agencyColor(a.key), borderColor: agencyColor(a.key) } : undefined}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-slate-500 self-center mr-1">Jump to:</span>
          {DECADES.map(d => (
            <button
              key={d}
              onClick={() => scrollToDecade(d)}
              className="px-2.5 py-1 rounded text-xs font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm">No documents match these filters.</p>
        </div>
      ) : (
        <div
          className="overflow-x-auto scroll-container"
          style={{ paddingBottom: selectedDoc ? '7rem' : '6rem' }}
        >
          <div className="relative min-w-max px-6 pt-4 pb-8">
            {/* Horizontal axis */}
            <div className="absolute left-0 right-0 top-[22px] h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

            <div className="flex items-start">
              {grouped.map((group) => {
                const colWidth = Math.max(170, Math.min(220, group.docs.length * 28 + 110))
                return (
                  <div
                    key={group.year}
                    ref={el => { if (el) yearRefs.current[group.year] = el }}
                    className="flex-shrink-0 pr-2"
                    style={{ width: colWidth }}
                  >
                    {/* Year context annotation */}
                    {YEAR_CONTEXT[group.year] && (
                      <div className="mb-1 z-10 relative">
                        <span className="text-[9px] text-amber-500/70 bg-slate-950 pr-1 italic">{YEAR_CONTEXT[group.year]}</span>
                      </div>
                    )}
                    {/* Year marker */}
                    <div className="relative flex items-center gap-2 mb-4 z-10">
                      <div className={`w-2.5 h-2.5 rounded-full border-2 border-slate-950 shrink-0 ${group.docs.length >= 5 ? 'bg-amber-500' : 'bg-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-200 bg-slate-950 pr-1">{group.year}</span>
                      <span className={`text-[10px] bg-slate-950 pr-1 tabular-nums ${group.docs.length >= 5 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>{group.docs.length}</span>
                    </div>

                    {/* Document chips */}
                    <div className="space-y-1.5 pl-1">
                      {group.docs.slice(0, 6).map(doc => {
                        const icon = getIcon(doc.title)
                        const isSelected = selectedDoc?.id === doc.id
                        return (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDoc(isSelected ? null : doc)}
                            className={`w-full text-left rounded px-2 py-1.5 transition-all cursor-pointer border-l-2 ${
                              isSelected
                                ? 'bg-slate-800 ring-1 ring-blue-500/40'
                                : 'bg-slate-900/70 hover:bg-slate-800/50 hover:translate-y-[-1px]'
                            }`}
                            style={{ borderLeftColor: agencyColor(doc.agency) }}
                          >
                            <div className="flex items-start gap-1.5">
                              {icon && <span className="text-sm shrink-0 mt-px">{icon}</span>}
                              <div className="min-w-0">
                                <span className="text-[11px] font-medium text-slate-300 line-clamp-2 leading-tight block">
                                  {doc.title}
                                </span>
                                {doc.incident_date_parsed && (
                                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                                    {formatDate(doc.incident_date_parsed)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      {group.docs.length > 6 && (
                        <div className="text-[10px] text-slate-500 pl-2">+{group.docs.length - 6} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected document detail panel */}
      {selectedDoc && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 safe-area-pb">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-100 leading-snug mb-1">
                  {selectedDoc.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                  {selectedDoc.agency && (
                    <span className={`agency-badge ${agencyClass(selectedDoc.agency)}`}>{selectedDoc.agency}</span>
                  )}
                  {selectedDoc.incident_date_parsed && (
                    <span className="text-slate-500">{formatDate(selectedDoc.incident_date_parsed)}</span>
                  )}
                  {selectedDoc.incident_location && (
                    <span className="text-slate-500">{selectedDoc.incident_location}</span>
                  )}
                  {selectedDoc.has_redaction && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Redacted</span>
                  )}
                </div>
                {selectedDoc.behaviors?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedDoc.behaviors.slice(0, 5).map(b => (
                      <span key={b} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{b}</span>
                    ))}
                  </div>
                )}
                <Link to={`/documents/${selectedDoc.id}`} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  View Document &rarr;
                </Link>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer text-lg leading-none">&times;</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
