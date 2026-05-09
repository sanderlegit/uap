import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { agencyColor, thumbUrl } from '../hooks/useData'

const LAYER_COLORS = {
  center: '#f59e0b',
  surveillance: '#3b82f6',
  custodial: '#f59e0b',
  industrial: '#ef4444',
}

const LAYER_LABELS = {
  surveillance: 'Surveillance',
  custodial: 'Custodial',
  industrial: 'Industrial',
}

function DetailPanel({ node, onClose }) {
  if (!node) return null

  const isDoc = node.type === 'document'
  const color = node.color || '#94a3b8'

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl z-20 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color }}>
          {node.layer === 'center' ? 'The Legacy Program' : LAYER_LABELS[node.layer] || node.type}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none cursor-pointer">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isDoc && (
          <img
            src={thumbUrl(node.doc_id)}
            alt=""
            className="w-full max-w-[200px] rounded mb-3 bg-slate-800"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        )}
        <h3 className="text-base font-bold text-slate-100 mb-2 leading-snug">{node.label}</h3>
        {node.description && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3">{node.description}</p>
        )}
        {isDoc && (
          <div className="space-y-2 mb-3">
            {node.agency && (
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">Agency:</span> {node.agency}
              </div>
            )}
            {node.decade && (
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">Decade:</span> {node.decade}
              </div>
            )}
            {node.pages > 0 && (
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">Pages:</span> {node.pages}
              </div>
            )}
            {node.has_redaction && (
              <div className="text-xs text-red-400">Contains redactions</div>
            )}
          </div>
        )}
        {node.connections && node.connections.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-2">Connections</h4>
            <div className="space-y-1.5">
              {node.connections.map((c, i) => (
                <div key={i} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                  <div>
                    <span className="text-slate-300">{c.label}</span>
                    {c.reason && <span className="text-slate-500 block text-[11px]">{c.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isDoc && (
          <Link
            to={`/documents/${node.doc_id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-wider hover:bg-amber-500/20 transition-colors"
          >
            View Document &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}

function LayerLegend({ activeLayer, onToggle }) {
  return (
    <div className="absolute left-4 bottom-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Layers</p>
      {Object.entries(LAYER_LABELS).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={`flex items-center gap-2 w-full text-left py-1 transition-colors cursor-pointer ${
            activeLayer === null || activeLayer === key ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LAYER_COLORS[key] }} />
          <span className="text-xs text-slate-300">{label}</span>
        </button>
      ))}
      {activeLayer && (
        <button onClick={() => onToggle(null)} className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 cursor-pointer">
          Show all
        </button>
      )}
    </div>
  )
}

function StatsBar({ data }) {
  if (!data) return null
  return (
    <div className="absolute left-4 top-4 z-20 flex items-center gap-4">
      <div className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-amber-400 font-mono">{data.metadata?.total_documents || 0}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Documents</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div className="text-center">
          <div className="text-lg font-bold text-slate-200 font-mono">{data.nodes?.filter(n => n.type === 'org' || n.type === 'layer').length || 0}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Program Nodes</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div className="text-center">
          <div className="text-lg font-bold text-slate-200 font-mono">{data.metadata?.total_connections || 0}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Connections</div>
        </div>
      </div>
    </div>
  )
}

export default function LegacyWeb() {
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [data, setData] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [activeLayer, setActiveLayer] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load data
  useEffect(() => {
    fetch('/data/legacy_web.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Node lookup for detail panel connections
  const nodeMap = useMemo(() => {
    if (!data) return {}
    const map = {}
    data.nodes.forEach(n => { map[n.id] = n })
    return map
  }, [data])

  // Build Cytoscape
  useEffect(() => {
    if (!data || !containerRef.current) return

    let cancelled = false

    import('cytoscape').then(mod => {
      if (cancelled) return
      const cytoscape = mod.default || mod

      const elements = []

      // Add nodes
      data.nodes.forEach(n => {
        elements.push({
          group: 'nodes',
          data: {
            id: n.id,
            label: n.label,
            nodeType: n.type,
            layer: n.layer,
            color: n.color,
            nodeSize: n.size || 15,
            docId: n.doc_id,
            agency: n.agency,
          },
        })
      })

      // Add edges
      data.edges.forEach((e, i) => {
        elements.push({
          group: 'edges',
          data: {
            id: `e${i}`,
            source: e.source,
            target: e.target,
            edgeType: e.type,
            weight: e.weight || 0.5,
          },
        })
      })

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: 'node[nodeType="hub"]',
            style: {
              'background-color': '#f59e0b',
              'label': 'data(label)',
              'color': '#fbbf24',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '14px',
              'font-weight': 'bold',
              'text-wrap': 'wrap',
              'text-max-width': '120px',
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'border-width': 3,
              'border-color': '#fbbf2440',
              'text-outline-width': 2,
              'text-outline-color': '#020617',
            },
          },
          {
            selector: 'node[nodeType="layer"]',
            style: {
              'background-color': 'data(color)',
              'label': 'data(label)',
              'color': '#e2e8f0',
              'text-valign': 'bottom',
              'text-margin-y': 8,
              'font-size': '11px',
              'font-weight': 'bold',
              'text-wrap': 'wrap',
              'text-max-width': '100px',
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'border-width': 2,
              'border-color': 'data(color)',
              'border-opacity': 0.3,
              'text-outline-width': 2,
              'text-outline-color': '#020617',
            },
          },
          {
            selector: 'node[nodeType="org"]',
            style: {
              'background-color': 'data(color)',
              'background-opacity': 0.7,
              'label': 'data(label)',
              'color': '#cbd5e1',
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'font-size': '9px',
              'font-weight': '600',
              'text-wrap': 'wrap',
              'text-max-width': '80px',
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'border-width': 1,
              'border-color': 'data(color)',
              'border-opacity': 0.4,
              'text-outline-width': 1.5,
              'text-outline-color': '#020617',
            },
          },
          {
            selector: 'node[nodeType="document"]',
            style: {
              'background-color': 'data(color)',
              'background-opacity': 0.5,
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'label': '',
              'border-width': 1,
              'border-color': 'data(color)',
              'border-opacity': 0.3,
            },
          },
          {
            selector: 'edge[edgeType="structure"]',
            style: {
              'line-color': '#475569',
              'width': 2,
              'curve-style': 'bezier',
              'opacity': 0.6,
            },
          },
          {
            selector: 'edge[edgeType="document"]',
            style: {
              'line-color': '#334155',
              'width': 1,
              'curve-style': 'bezier',
              'opacity': 0.15,
            },
          },
          {
            selector: 'edge[edgeType="cross"]',
            style: {
              'line-color': '#6b7280',
              'width': 1.5,
              'line-style': 'dashed',
              'curve-style': 'bezier',
              'opacity': 0.3,
            },
          },
          {
            selector: ':selected',
            style: {
              'border-width': 3,
              'border-color': '#fbbf24',
              'overlay-opacity': 0,
            },
          },
          {
            selector: '.highlighted',
            style: {
              'border-width': 3,
              'border-color': '#fbbf24',
              'background-opacity': 1,
              'z-index': 100,
            },
          },
          {
            selector: '.highlighted-edge',
            style: {
              'line-color': '#fbbf24',
              'opacity': 0.7,
              'width': 2,
              'z-index': 100,
            },
          },
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.08,
            },
          },
          {
            selector: 'node[nodeType="document"].show-label',
            style: {
              'label': 'data(label)',
              'color': '#e2e8f0',
              'font-size': '7px',
              'text-valign': 'bottom',
              'text-margin-y': 5,
              'text-outline-width': 1.5,
              'text-outline-color': '#020617',
              'text-wrap': 'ellipsis',
              'text-max-width': '60px',
            },
          },
        ],
        layout: {
          name: 'concentric',
          concentric: (node) => {
            const t = node.data('nodeType')
            if (t === 'hub') return 100
            if (t === 'layer') return 70
            if (t === 'org') return 40
            return 10
          },
          levelWidth: () => 1,
          minNodeSpacing: 20,
          spacingFactor: 1.5,
          animate: true,
          animationDuration: 1200,
          animationEasing: 'ease-out-cubic',
        },
        minZoom: 0.15,
        maxZoom: 4,
        wheelSensitivity: 0.3,
      })

      // Click handler
      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const nodeData = data.nodes.find(n => n.id === node.id())
        if (!nodeData) return

        // Reset all
        cy.elements().removeClass('highlighted highlighted-edge dimmed show-label')

        // Highlight clicked + neighbors
        const neighborhood = node.neighborhood()
        cy.elements().addClass('dimmed')
        node.removeClass('dimmed').addClass('highlighted')
        neighborhood.removeClass('dimmed')
        neighborhood.edges().addClass('highlighted-edge')
        neighborhood.nodes().addClass('show-label')

        // Build connections for detail panel
        const connections = []
        neighborhood.nodes().forEach(n => {
          if (n.id() === node.id()) return
          const nData = data.nodes.find(nd => nd.id === n.id())
          const edge = data.edges.find(e =>
            (e.source === node.id() && e.target === n.id()) ||
            (e.target === node.id() && e.source === n.id())
          )
          if (nData) {
            connections.push({
              label: nData.label,
              color: nData.color,
              reason: edge?.reason,
            })
          }
        })

        setSelectedNode({ ...nodeData, connections })
      })

      // Click background to deselect
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted highlighted-edge dimmed show-label')
          setSelectedNode(null)
        }
      })

      // Hover effects
      cy.on('mouseover', 'node', (evt) => {
        containerRef.current.style.cursor = 'pointer'
        const node = evt.target
        if (node.data('nodeType') === 'document') {
          node.addClass('show-label')
        }
      })

      cy.on('mouseout', 'node', (evt) => {
        containerRef.current.style.cursor = 'default'
        const node = evt.target
        if (!node.hasClass('highlighted') && node.data('nodeType') === 'document') {
          node.removeClass('show-label')
        }
      })

      cyRef.current = cy

      return () => {
        cy.destroy()
        cyRef.current = null
      }
    })

    return () => { cancelled = true }
  }, [data])

  // Layer filter
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('dimmed highlighted highlighted-edge show-label')
    setSelectedNode(null)

    if (activeLayer) {
      cy.nodes().forEach(node => {
        const layer = node.data('layer')
        const type = node.data('nodeType')
        if (type === 'hub') return
        if (layer !== activeLayer && type !== 'hub') {
          node.addClass('dimmed')
        }
      })
      cy.edges().forEach(edge => {
        const src = cy.getElementById(edge.data('source'))
        const tgt = cy.getElementById(edge.data('target'))
        if (src.hasClass('dimmed') || tgt.hasClass('dimmed')) {
          edge.addClass('dimmed')
        }
      })
    }
  }, [activeLayer])

  const handleLayerToggle = useCallback((layer) => {
    setActiveLayer(prev => prev === layer ? null : layer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-mono tracking-wider">Mapping the web...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
        <p className="text-slate-500">Failed to load Legacy Program data.</p>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] bg-slate-950 overflow-hidden">
      {/* Cytoscape container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Stats bar */}
      <StatsBar data={data} />

      {/* Layer legend */}
      <LayerLegend activeLayer={activeLayer} onToggle={handleLayerToggle} />

      {/* Detail panel */}
      <DetailPanel node={selectedNode} onClose={() => {
        setSelectedNode(null)
        cyRef.current?.elements().removeClass('highlighted highlighted-edge dimmed show-label')
      }} />

      {/* Instructions */}
      {!selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-700/40 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-500 font-mono">Click any node to explore connections. Scroll to zoom. Drag to pan.</p>
        </div>
      )}
    </div>
  )
}
