import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useDocuments, agencyColor, agencyClass, formatDate } from '../hooks/useData'

const AGENCIES = [
  { label: 'Dept. of War', color: '#3b82f6' },
  { label: 'FBI', color: '#ef4444' },
  { label: 'NASA', color: '#8b5cf6' },
  { label: 'Dept. of State', color: '#10b981' },
]

function Spinner() {
  return (
    <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading map data...</p>
      </div>
    </div>
  )
}

export default function MapView() {
  const docs = useDocuments()

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
                    <span className={`agency-badge ${agencyClass(doc.agency)}`}>
                      {doc.agency}
                    </span>
                  )}
                </div>
                {doc.incident_date_parsed && (
                  <p className="text-xs text-slate-400 mb-0.5">
                    {formatDate(doc.incident_date_parsed)}
                  </p>
                )}
                {doc.incident_location && (
                  <p className="text-xs text-slate-400 mb-2">{doc.incident_location}</p>
                )}
                <Link
                  to={`/documents/${doc.id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  View Document &rarr;
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
          Agencies
        </p>
        <div className="flex flex-col gap-1">
          {AGENCIES.map(a => (
            <div key={a.label} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <span className="text-xs text-slate-300">{a.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          {geolocated.length} of {docs.length} documents mapped
        </p>
      </div>
    </div>
  )
}
