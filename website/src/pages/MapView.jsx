import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useDocuments, agencyColor, agencyClass, formatDate, thumbUrl } from '../hooks/useData'

const AGENCIES = [
  { label: 'Dept. of War', color: '#3b82f6' },
  { label: 'FBI', color: '#ef4444' },
  { label: 'NASA', color: '#8b5cf6' },
  { label: 'Dept. of State', color: '#10b981' },
]

const SPACE_ENCOUNTERS = [
  { name: 'Gemini IV Object', year: 1965, body: 'orbit', detail: 'Astronaut James McDivitt photographed a cylindrical object with a protrusion during orbital EVA preparations.', icon: '🛰', docIds: [] },
  { name: 'Apollo 11 Translunar Object', year: 1969, body: 'moon', detail: 'Crew observed an L-shaped object through the window en route to the Moon, initially thought to be the S-IVB booster.', icon: '🌙', docIds: [103] },
  { name: 'Apollo 12 Lightning Events', year: 1969, body: 'moon', detail: 'Unusual double lightning strike during launch plus anomalous objects observed in lunar orbit.', icon: '🌙', docIds: [50, 51, 52, 53, 54, 101] },
  { name: 'STS-48 Maneuver Objects', year: 1991, body: 'orbit', detail: 'Space Shuttle Discovery footage captured objects making apparent sharp directional changes near the spacecraft.', icon: '🛰', docIds: [] },
  { name: 'STS-75 Tether Swarm', year: 1996, body: 'orbit', detail: 'Hundreds of luminous pulsing objects observed near the broken TSS-1R tether during shuttle mission.', icon: '🛰', docIds: [] },
  { name: 'ISS Multiple Sightings', year: 2005, body: 'orbit', detail: 'Multiple ISS crew members across several expeditions reported unidentified objects near the station, some captured on external cameras.', icon: '🛰', docIds: [] },
  { name: 'Apollo 17 Lunar Anomalies', year: 1972, body: 'moon', detail: 'Crew debriefing transcripts reference anomalous light phenomena observed during lunar surface EVAs.', icon: '🌙', docIds: [55, 102, 104, 105] },
]

function Spinner() {
  return (
    <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading map data&hellip;</p>
      </div>
    </div>
  )
}

function MoonGraphic() {
  return (
    <div className="relative w-20 h-20 mx-auto">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 shadow-[0_0_30px_rgba(148,163,184,0.3)]" />
      <div className="absolute top-3 left-4 w-4 h-4 rounded-full bg-slate-500/40" />
      <div className="absolute top-8 left-9 w-2.5 h-2.5 rounded-full bg-slate-500/30" />
      <div className="absolute top-5 right-3 w-3 h-3 rounded-full bg-slate-500/35" />
      <div className="absolute bottom-3 left-6 w-2 h-2 rounded-full bg-slate-500/25" />
    </div>
  )
}

function OrbitGraphic({ count }) {
  return (
    <div className="relative w-24 h-24 mx-auto">
      <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/30" />
      <div className="absolute inset-3 rounded-full border border-cyan-500/20" />
      {/* Earth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-emerald-500 shadow-[0_0_12px_rgba(56,189,248,0.4)]" />
      {/* Orbit dots */}
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2
        const r = 44
        const x = 48 + Math.cos(angle) * r
        const y = 48 + Math.sin(angle) * r
        return (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
            style={{ left: x - 4, top: y - 4 }}
          />
        )
      })}
    </div>
  )
}

function SpaceSidebar({ expandedEncounter, setExpandedEncounter, docs }) {
  const moonEncounters = SPACE_ENCOUNTERS.filter(e => e.body === 'moon')
  const orbitEncounters = SPACE_ENCOUNTERS.filter(e => e.body === 'orbit')

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#070b14] via-[#0a0f1a] to-[#060a12] border-l border-slate-800/60 px-4 py-5"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>

      {/* Starfield dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() > 0.7 ? 2 : 1,
              height: Math.random() > 0.7 ? 2 : 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: 0.1 + Math.random() * 0.3,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <h3 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-purple-400 mb-1">Beyond Earth</h3>
        <p className="text-[10px] text-slate-500 mb-5">{SPACE_ENCOUNTERS.length} documented encounters</p>

        {/* Moon Section */}
        <div className="mb-6">
          <MoonGraphic />
          <div className="text-center mt-2 mb-3">
            <span className="text-xs font-semibold text-slate-300">Moon</span>
            <span className="text-[10px] text-slate-500 ml-2">{moonEncounters.length} events</span>
          </div>
          <div className="space-y-1.5">
            {moonEncounters.map((enc, i) => {
              const idx = SPACE_ENCOUNTERS.indexOf(enc)
              return (
                <button
                  key={i}
                  onClick={() => setExpandedEncounter(expandedEncounter === idx ? null : idx)}
                  className={`w-full text-left rounded px-2.5 py-2 transition-all cursor-pointer border-l-2 ${
                    expandedEncounter === idx
                      ? 'bg-purple-500/10 border-l-purple-400'
                      : 'bg-slate-800/30 border-l-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-200">{enc.name}</div>
                  <div className="text-[10px] text-slate-500">{enc.year}</div>
                  {expandedEncounter === idx && (
                    <div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{enc.detail}</p>
                      {enc.docIds?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {enc.docIds.map(docId => {
                            const d = docs?.find(x => x.id === docId)
                            return d ? (
                              <Link key={docId} to={`/documents/${docId}`} className="flex items-center gap-2 py-1 px-1.5 -mx-1.5 rounded hover:bg-purple-500/10 transition-colors group">
                                <img src={thumbUrl(docId)} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0 bg-slate-800" onError={e => { e.target.style.display = 'none' }} />
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-200 line-clamp-1">{d.title}</span>
                              </Link>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Orbit Section */}
        <div className="mb-6">
          <OrbitGraphic count={orbitEncounters.length} />
          <div className="text-center mt-2 mb-3">
            <span className="text-xs font-semibold text-slate-300">Earth Orbit</span>
            <span className="text-[10px] text-slate-500 ml-2">{orbitEncounters.length} events</span>
          </div>
          <div className="space-y-1.5">
            {orbitEncounters.map((enc, i) => {
              const idx = SPACE_ENCOUNTERS.indexOf(enc)
              return (
                <button
                  key={i}
                  onClick={() => setExpandedEncounter(expandedEncounter === idx ? null : idx)}
                  className={`w-full text-left rounded px-2.5 py-2 transition-all cursor-pointer border-l-2 ${
                    expandedEncounter === idx
                      ? 'bg-cyan-500/10 border-l-cyan-400'
                      : 'bg-slate-800/30 border-l-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-200">{enc.name}</div>
                  <div className="text-[10px] text-slate-500">{enc.year}</div>
                  {expandedEncounter === idx && (
                    <div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{enc.detail}</p>
                      {enc.docIds?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {enc.docIds.map(docId => {
                            const d = docs?.find(x => x.id === docId)
                            return d ? (
                              <Link key={docId} to={`/documents/${docId}`} className="flex items-center gap-2 py-1 px-1.5 -mx-1.5 rounded hover:bg-cyan-500/10 transition-colors group">
                                <img src={thumbUrl(docId)} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0 bg-slate-800" onError={e => { e.target.style.display = 'none' }} />
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-200 line-clamp-1">{d.title}</span>
                              </Link>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Distant bodies */}
        <div className="border-t border-slate-800/60 pt-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Outer System</p>
          <div className="flex gap-4 justify-center mb-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">🔴</span>
              <span className="text-[9px] text-slate-500">Mars</span>
              <span className="text-[9px] text-slate-700">&mdash;</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">🪐</span>
              <span className="text-[9px] text-slate-500">Saturn</span>
              <span className="text-[9px] text-slate-700">&mdash;</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">⭐</span>
              <span className="text-[9px] text-slate-500">Deep Space</span>
              <span className="text-[9px] text-slate-700">&mdash;</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-700 text-center italic">No confirmed encounters beyond LEO/lunar space</p>
        </div>

        <p className="text-[10px] text-slate-700 mt-4 pt-3 border-t border-slate-800/40 text-center">
          Sources: astronaut testimony, NASA mission footage
        </p>
      </div>
    </div>
  )
}

function MapSync({ searchParams, setSearchParams, mapRef }) {
  const map = useMap()
  const timerRef = useRef(null)
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams

  useEffect(() => { mapRef.current = map }, [map, mapRef])

  useEffect(() => {
    function onMoveEnd() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const center = map.getCenter()
        const zoom = map.getZoom()
        const next = new URLSearchParams(searchParamsRef.current)
        next.set('lat', center.lat.toFixed(2))
        next.set('lng', center.lng.toFixed(2))
        next.set('zoom', String(zoom))
        setSearchParams(next, { replace: true })
      }, 500)
    }
    map.on('moveend', onMoveEnd)
    return () => {
      map.off('moveend', onMoveEnd)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [map, setSearchParams])

  return null
}

export default function MapView() {
  const docs = useDocuments()
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedEncounter, setExpandedEncounter] = useState(null)
  const [mobileSpaceOpen, setMobileSpaceOpen] = useState(false)
  const [docListOpen, setDocListOpen] = useState(false)
  const mapRef = useRef(null)

  const initialLat = parseFloat(searchParams.get('lat')) || 20
  const initialLng = parseFloat(searchParams.get('lng')) || 0
  const initialZoom = parseInt(searchParams.get('zoom')) || 2
  const selectedDocId = searchParams.get('doc') || null

  const geolocated = useMemo(() => {
    if (!docs) return []
    return docs.filter(d => d.latitude != null && d.longitude != null)
  }, [docs])

  if (!docs) return <Spinner />

  return (
    <div className="relative h-[calc(100dvh-7.5rem-3.5rem)] md:h-[calc(100dvh-7.5rem)] flex">
      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[initialLat, initialLng]}
          zoom={initialZoom}
          className="h-full w-full z-0"
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <MapSync searchParams={searchParams} setSearchParams={setSearchParams} mapRef={mapRef} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {geolocated.map(doc => {
            const isSelected = String(doc.id) === selectedDocId
            return (
              <CircleMarker
                key={doc.id}
                center={[doc.latitude, doc.longitude]}
                radius={isSelected ? 12 : 8}
                pathOptions={{
                  color: isSelected ? '#f59e0b' : agencyColor(doc.agency),
                  fillColor: agencyColor(doc.agency),
                  fillOpacity: isSelected ? 0.9 : 0.7,
                  weight: isSelected ? 3 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    const next = new URLSearchParams(searchParams)
                    next.set('doc', String(doc.id))
                    setSearchParams(next, { replace: true })
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex gap-3 mb-2">
                      <img src={thumbUrl(doc.id)} alt="" className="w-10 h-[52px] object-cover rounded bg-slate-800 flex-shrink-0" onError={(e) => { e.target.style.display = 'none' }} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-100 leading-snug mb-1">{doc.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {doc.agency && <span className={`agency-badge ${agencyClass(doc.agency)}`}>{doc.agency}</span>}
                        </div>
                      </div>
                    </div>
                    {doc.incident_date_parsed && <p className="text-xs text-slate-400 mb-0.5">{formatDate(doc.incident_date_parsed)}</p>}
                    {doc.incident_location && <p className="text-xs text-slate-400 mb-2">{doc.incident_location}</p>}
                    <Link to={`/documents/${doc.id}`} className="text-xs text-blue-400 hover:text-blue-300 font-medium">View Document &rarr;</Link>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        {/* Agency Legend */}
        <div className="absolute bottom-6 left-3 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Agencies</p>
          <div className="flex flex-col gap-1">
            {AGENCIES.map(a => (
              <div key={a.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-xs text-slate-300">{a.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">{geolocated.length} of {docs.length} mapped</p>
          <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700/40">
            <Link to={`/timeline${selectedDocId ? `?doc=${selectedDocId}` : ''}`} className="text-[11px] text-indigo-400/70 hover:text-indigo-400 py-1">Timeline</Link>
            <Link to={`/graph${selectedDocId ? `?node=${selectedDocId}` : ''}`} className="text-[11px] text-indigo-400/70 hover:text-indigo-400 py-1">Graph</Link>
            <Link to="/documents" className="text-[11px] text-indigo-400/70 hover:text-indigo-400 py-1">All Docs</Link>
          </div>
        </div>

        {/* Document list panel */}
        <div className="absolute top-3 left-3 z-[1000]">
          <button
            onClick={() => setDocListOpen(!docListOpen)}
            className={`bg-slate-900/90 backdrop-blur border rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
              docListOpen ? 'border-amber-500/50 bg-slate-900/95' : 'border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <span className="text-xs font-medium text-slate-300">Documents</span>
            <span className="text-[10px] text-amber-400 bg-amber-500/20 rounded px-1.5 py-0.5 tabular-nums">{geolocated.length}</span>
          </button>

          {docListOpen && (
            <div className="mt-1.5 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-lg w-72 max-h-[60vh] overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Mapped Documents</span>
                <button onClick={() => setDocListOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-sm leading-none">&times;</button>
              </div>
              <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                {geolocated.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set('doc', String(doc.id))
                      setSearchParams(next, { replace: true })
                      mapRef.current?.flyTo([doc.latitude, doc.longitude], Math.max(mapRef.current.getZoom(), 6), { duration: 0.8 })
                    }}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition-colors cursor-pointer border-b border-slate-800/30 hover:bg-slate-800/50 ${
                      String(doc.id) === selectedDocId ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <img
                      src={thumbUrl(doc.id)}
                      alt=""
                      className="w-8 h-10 object-cover rounded flex-shrink-0 bg-slate-800"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-200 line-clamp-1 leading-snug">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.agency && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agencyColor(doc.agency) }} />
                        )}
                        <span className="text-[10px] text-slate-500 line-clamp-1">{doc.incident_location || 'Location unknown'}</span>
                      </div>
                    </div>
                    <Link
                      to={`/documents/${doc.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-indigo-400/70 hover:text-indigo-400 flex-shrink-0"
                    >
                      →
                    </Link>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile space toggle */}
        <button
          onClick={() => setMobileSpaceOpen(!mobileSpaceOpen)}
          className="md:hidden absolute top-3 right-3 z-[1000] bg-[#070b14]/95 backdrop-blur border border-purple-500/30 rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-purple-500/50 transition-colors"
        >
          <span className="text-base">🌌</span>
          <span className="text-xs font-medium text-purple-300">Space</span>
          <span className="text-[10px] text-purple-400 bg-purple-500/20 rounded px-1.5 py-0.5 tabular-nums">{SPACE_ENCOUNTERS.length}</span>
        </button>
      </div>

      {/* Desktop: persistent space sidebar */}
      <div className="hidden md:block w-64 lg:w-72 relative shrink-0">
        <SpaceSidebar expandedEncounter={expandedEncounter} setExpandedEncounter={setExpandedEncounter} docs={docs} />
      </div>

      {/* Mobile: slide-up panel */}
      {mobileSpaceOpen && (
        <div className="md:hidden absolute inset-x-0 bottom-0 z-[1001] h-[60vh] rounded-t-xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 bg-[#070b14] border-b border-slate-800/60">
            <span className="text-xs font-semibold text-purple-400">Space Encounters</span>
            <button onClick={() => setMobileSpaceOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-lg leading-none w-10 h-10 flex items-center justify-center">&times;</button>
          </div>
          <SpaceSidebar expandedEncounter={expandedEncounter} setExpandedEncounter={setExpandedEncounter} docs={docs} />
        </div>
      )}
    </div>
  )
}
