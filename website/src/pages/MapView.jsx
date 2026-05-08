import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useDocuments, agencyColor, agencyClass, formatDate } from '../hooks/useData'

const AGENCIES = [
  { label: 'Dept. of War', color: '#3b82f6' },
  { label: 'FBI', color: '#ef4444' },
  { label: 'NASA', color: '#8b5cf6' },
  { label: 'Dept. of State', color: '#10b981' },
]

const SPACE_ENCOUNTERS = [
  { name: 'Gemini IV Object', year: 1965, body: 'Earth Orbit', detail: 'Astronaut James McDivitt photographed a cylindrical object with a protrusion during orbital EVA preparations.', icon: '🛰' },
  { name: 'Apollo 11 Translunar Object', year: 1969, body: 'Moon Transit', detail: 'Crew observed an L-shaped object through the window en route to the Moon, initially thought to be the S-IVB booster.', icon: '🌙' },
  { name: 'Apollo 12 Lightning Events', year: 1969, body: 'Moon', detail: 'Unusual double lightning strike during launch plus anomalous objects observed in lunar orbit.', icon: '🌙' },
  { name: 'STS-48 Maneuver Objects', year: 1991, body: 'Earth Orbit', detail: 'Space Shuttle Discovery footage captured objects making apparent sharp directional changes near the spacecraft.', icon: '🛰' },
  { name: 'STS-75 Tether Swarm', year: 1996, body: 'Earth Orbit', detail: 'Hundreds of luminous pulsing objects observed near the broken TSS-1R tether during shuttle mission.', icon: '🛰' },
  { name: 'ISS Multiple Sightings', year: 2005, body: 'Earth Orbit', detail: 'Multiple ISS crew members across several expeditions have reported unidentified objects near the station, some captured on external cameras.', icon: '🛰' },
]

const CELESTIAL = [
  { name: 'Earth Orbit', icon: '🛰', count: 4, color: '#38bdf8' },
  { name: 'Moon', icon: '🌙', count: 2, color: '#94a3b8' },
  { name: 'Mars', icon: '🔴', count: 0, color: '#ef4444', note: 'No confirmed encounters' },
  { name: 'Saturn', icon: '🪐', count: 0, color: '#fbbf24', note: 'Cassini anomalies under review' },
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

export default function MapView() {
  const docs = useDocuments()
  const [spaceOpen, setSpaceOpen] = useState(false)
  const [expandedEncounter, setExpandedEncounter] = useState(null)

  const geolocated = useMemo(() => {
    if (!docs) return []
    return docs.filter(d => d.latitude != null && d.longitude != null)
  }, [docs])

  if (!docs) return <Spinner />

  return (
    <div className="relative h-[calc(100dvh-7.5rem)]">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full z-0"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {geolocated.map(doc => (
          <CircleMarker
            key={doc.id}
            center={[doc.latitude, doc.longitude]}
            radius={8}
            pathOptions={{
              color: agencyColor(doc.agency),
              fillColor: agencyColor(doc.agency),
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="text-sm font-semibold text-slate-100 leading-snug mb-1.5">
                  {doc.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                  {doc.agency && (
                    <span className={`agency-badge ${agencyClass(doc.agency)}`}>{doc.agency}</span>
                  )}
                </div>
                {doc.incident_date_parsed && (
                  <p className="text-xs text-slate-400 mb-0.5">{formatDate(doc.incident_date_parsed)}</p>
                )}
                {doc.incident_location && (
                  <p className="text-xs text-slate-400 mb-2">{doc.incident_location}</p>
                )}
                <Link to={`/documents/${doc.id}`} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  View Document &rarr;
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
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
        <p className="text-[10px] text-slate-500 mt-2">
          {geolocated.length} of {docs.length} documents mapped
        </p>
      </div>

      {/* Space Encounters Button */}
      <button
        onClick={() => setSpaceOpen(!spaceOpen)}
        className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur border border-purple-500/30 rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-purple-500/50 transition-colors"
      >
        <span className="text-base">🌌</span>
        <span className="text-xs font-medium text-purple-300">Space</span>
        <span className="text-[10px] text-purple-400 bg-purple-500/20 rounded px-1.5 py-0.5 tabular-nums">{SPACE_ENCOUNTERS.length}</span>
      </button>

      {/* Space Encounters Panel */}
      {spaceOpen && (
        <div className="absolute top-14 right-3 z-[1000] bg-slate-900/95 backdrop-blur border border-purple-500/20 rounded-lg p-4 w-80 max-h-[70vh] overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-100">Beyond Earth</h3>
            <button onClick={() => setSpaceOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-lg leading-none">&times;</button>
          </div>

          {/* Celestial bodies */}
          <div className="grid grid-cols-4 gap-2 mb-4 py-3 bg-slate-950/80 rounded-lg border border-slate-800/50 px-2">
            {CELESTIAL.map(b => (
              <div key={b.name} className="flex flex-col items-center gap-1 text-center">
                <span className="text-xl">{b.icon}</span>
                <span className="text-[9px] text-slate-400 leading-tight">{b.name}</span>
                {b.count > 0 ? (
                  <span className="text-[10px] font-bold" style={{ color: b.color }}>{b.count}</span>
                ) : (
                  <span className="text-[10px] text-slate-700">&mdash;</span>
                )}
              </div>
            ))}
          </div>

          {/* Encounters */}
          <div className="space-y-2">
            {SPACE_ENCOUNTERS.map((enc, i) => (
              <button
                key={i}
                onClick={() => setExpandedEncounter(expandedEncounter === i ? null : i)}
                className={`w-full text-left rounded-lg p-2.5 border transition-all cursor-pointer ${
                  expandedEncounter === i
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-slate-800/50 border-slate-700/30 hover:border-slate-600/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0">{enc.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200">{enc.name}</div>
                    <div className="text-[10px] text-slate-500">{enc.year} &middot; {enc.body}</div>
                    {expandedEncounter === i && (
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{enc.detail}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-600 mt-3 pt-2 border-t border-slate-800">
            Based on astronaut testimony and NASA mission footage
          </p>
        </div>
      )}
    </div>
  )
}
