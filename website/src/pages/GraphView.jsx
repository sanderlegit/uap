import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cytoscape from 'cytoscape'
import { useGraph, agencyColor, agencyClass } from '../hooks/useData'

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
        <p className="text-slate-500 text-sm">Loading graph data...</p>
      </div>
    </div>
  )
}

export default function GraphView() {
  const graph = useGraph()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [selected, setSelected] = useState(null)

  const handleFit = useCallback(() => {
    if (cyRef.current) cyRef.current.fit(undefined, 40)
  }, [])

  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      const z = cyRef.current.zoom()
      cyRef.current.zoom({ level: z * 1.3, renderedPosition: { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 } })
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      const z = cyRef.current.zoom()
      cyRef.current.zoom({ level: z / 1.3, renderedPosition: { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 } })
    }
  }, [])

  useEffect(() => {
    if (!graph || !containerRef.current) return

    const nodes = graph.nodes.map(node => ({
      data: {
        id: String(node.id),
        label: node.label,
        agency: node.agency,
        decade: node.decade,
        connections: node.connections || 0,
        color: agencyColor(node.agency),
      },
    }))

    const edges = graph.edges.map((edge, i) => ({
      data: {
        id: `e${i}`,
        source: String(edge.source_id),
        target: String(edge.target_id),
        weight: edge.weight || 1,
      },
    }))

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            'font-size': 6,
            'text-wrap': 'ellipsis',
            'text-max-width': 80,
            color: '#94a3b8',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            shape: 'ellipse',
            width: 'mapData(connections, 0, 20, 15, 40)',
            height: 'mapData(connections, 0, 20, 15, 40)',
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#475569',
            width: 'mapData(weight, 1, 10, 0.5, 3)',
            opacity: 0.4,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 2,
            'border-color': '#f59e0b',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
      },
      minZoom: 0.1,
      maxZoom: 5,
    })

    cyRef.current = cy

    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      setSelected({
        id: node.data('id'),
        label: node.data('label'),
        agency: node.data('agency'),
        decade: node.data('decade'),
        connections: node.data('connections'),
      })
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelected(null)
      }
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [graph])

  if (!graph) return <Spinner />

  return (
    <div className="relative h-[calc(100dvh-7.5rem)]">
      {/* Cytoscape container */}
      <div ref={containerRef} className="w-full h-full bg-slate-950" />

      {/* Legend - top right */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2.5">
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
          {graph.nodes.length} nodes, {graph.edges.length} edges
        </p>
      </div>

      {/* Controls - bottom right */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleFit}
          className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-medium flex items-center justify-center cursor-pointer"
          title="Fit all"
        >
          ⊡
        </button>
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer"
          title="Zoom out"
        >
          &minus;
        </button>
      </div>

      {/* Info panel - selected node */}
      {selected && (
        <div className="absolute bottom-6 left-3 z-10 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-lg p-4 max-w-[280px]">
          <h3 className="text-sm font-semibold text-slate-100 leading-snug mb-2 line-clamp-3">
            {selected.label}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
            {selected.agency && (
              <span className={`agency-badge ${agencyClass(selected.agency)}`}>
                {selected.agency}
              </span>
            )}
            {selected.decade && (
              <span className="text-slate-500">{selected.decade}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {selected.connections} connection{selected.connections !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <Link
              to={`/documents/${selected.id}`}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View Document &rarr;
            </Link>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
