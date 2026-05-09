import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { agencyColor, agencyClass, thumbUrl } from '../hooks/useData'

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

const AGENCIES = [
  { key: 'Department of War', label: 'Dept. of War', color: '#3b82f6' },
  { key: 'FBI', label: 'FBI', color: '#ef4444' },
  { key: 'NASA', label: 'NASA', color: '#8b5cf6' },
  { key: 'Department of State', label: 'Dept. of State', color: '#10b981' },
]

const DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '2020s']

function DetailPanel({ node, narratives, onClose }) {
  if (!node) return null

  const isDoc = node.type === 'document'
  const color = isDoc ? agencyColor(node.agency) : (node.color || '#94a3b8')
  const narrative = isDoc && narratives ? narratives[String(node.doc_id)] : null

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl z-20 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color }}>
          {node.layer === 'center' ? 'The Legacy Program' : isDoc ? node.agency : (LAYER_LABELS[node.layer] || node.type)}
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
        {narrative?.hook && (
          <p className="text-xs text-slate-300 leading-relaxed mb-3">{narrative.hook}</p>
        )}
        {!narrative?.hook && node.description && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3">{node.description}</p>
        )}
        {isDoc && (
          <div className="space-y-2 mb-3">
            {node.agency && (
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">Agency:</span>{' '}
                <span className={`agency-badge ${agencyClass(node.agency)}`}>{node.agency}</span>
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
            <h4 className="text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-2">
              Connections ({node.connections.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {node.connections.map((c, i) => (
                <div key={i} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                  <div>
                    <span className="text-slate-300">{c.label}</span>
                    {c.reason && <span className="text-slate-500 block text-[11px]">{c.reason}</span>}
                    {c.edgeType === 'xref' && <span className="text-cyan-500/70 block text-[10px]">Cross-reference</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isDoc && (
          <div className="flex flex-col gap-2">
            <Link
              to={`/documents/${node.doc_id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-wider hover:bg-amber-500/20 transition-colors"
            >
              View Document &rarr;
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to={`/timeline?doc=${node.doc_id}${node.decade ? `&decade=${node.decade}` : ''}`}
                className="text-[10px] text-indigo-400/70 hover:text-indigo-400 font-mono"
              >
                Timeline &rarr;
              </Link>
              <Link
                to={`/map?doc=${node.doc_id}`}
                className="text-[10px] text-indigo-400/70 hover:text-indigo-400 font-mono"
              >
                Map &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LayerLegend({ activeLayer, onToggle, showXref, onToggleXref, xrefCount }) {
  return (
    <div className="absolute left-4 bottom-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Program Layers</p>
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
      <div className="border-t border-slate-700/50 mt-2 pt-2">
        <button
          onClick={onToggleXref}
          className={`flex items-center gap-2 w-full text-left py-1 transition-colors cursor-pointer ${
            showXref ? 'opacity-100' : 'opacity-40'
          }`}
        >
          <span className={`w-3 h-0.5 ${showXref ? 'bg-cyan-400' : 'bg-slate-500'}`} />
          <span className={`text-xs ${showXref ? 'text-cyan-300' : 'text-slate-400'}`}>
            Cross-refs
          </span>
          <span className="text-[9px] text-slate-600 ml-auto">{xrefCount}</span>
        </button>
      </div>
    </div>
  )
}

export default function LegacyWeb() {
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [data, setData] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [narratives, setNarratives] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [loading, setLoading] = useState(true)

  const [searchParams, setSearchParams] = useSearchParams()

  const activeLayer = searchParams.get('layer') || null
  const search = searchParams.get('q') || ''
  const showXref = searchParams.get('xref') === '1'
  const activeDecade = searchParams.get('decade') || null
  const hiddenAgencies = useMemo(() => {
    const v = searchParams.get('hide')
    return v ? new Set(v.split(',')) : new Set()
  }, [searchParams])

  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams

  const updateParam = useCallback((key, value) => {
    const next = new URLSearchParams(searchParamsRef.current)
    if (value === null || value === undefined || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    Promise.all([
      fetch('/data/legacy_web.json').then(r => r.json()),
      fetch('/data/graph.json').then(r => r.json()),
      fetch('/data/doc_narratives.json').then(r => r.json()).catch(() => null),
    ]).then(([lw, g, n]) => {
      setData(lw)
      setGraphData(g)
      setNarratives(n)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const xrefEdges = useMemo(() => {
    if (!graphData) return []
    return graphData.edges.map((e, i) => ({
      group: 'edges',
      data: {
        id: `xref_${i}`,
        source: `doc_${e.source_id}`,
        target: `doc_${e.target_id}`,
        edgeType: 'xref',
        weight: e.weight || 0.5,
        xrefType: e.edge_type,
      },
    }))
  }, [graphData])

  useEffect(() => {
    if (!data || !containerRef.current) return

    let cancelled = false

    import('cytoscape').then(mod => {
      if (cancelled) return
      const cytoscape = mod.default || mod

      const elements = []

      data.nodes.forEach(n => {
        const isDoc = n.type === 'document'
        elements.push({
          group: 'nodes',
          data: {
            id: n.id,
            label: n.label,
            nodeType: n.type,
            layer: n.layer,
            color: isDoc ? agencyColor(n.agency) : n.color,
            nodeSize: n.size || 15,
            docId: n.doc_id,
            agency: n.agency || '',
            decade: n.decade || '',
          },
        })
      })

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
              'background-opacity': 0.7,
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'label': '',
              'border-width': 1.5,
              'border-color': 'data(color)',
              'border-opacity': 0.4,
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
            selector: 'edge[edgeType="cross_layer"]',
            style: {
              'line-color': '#6b7280',
              'width': 1.5,
              'line-style': 'dashed',
              'curve-style': 'bezier',
              'opacity': 0.3,
            },
          },
          {
            selector: 'edge[edgeType="xref"]',
            style: {
              'line-color': '#22d3ee',
              'width': 'mapData(weight, 0, 1, 0.5, 2.5)',
              'curve-style': 'bezier',
              'opacity': 0.25,
              'line-style': 'dotted',
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
            selector: '.search-match',
            style: {
              'border-width': 3,
              'border-color': '#22d3ee',
              'border-opacity': 1,
              'background-opacity': 1,
              'z-index': 20,
            },
          },
          {
            selector: '.search-dim',
            style: {
              'opacity': 0.06,
              'text-opacity': 0,
            },
          },
          {
            selector: '.agency-hidden',
            style: {
              'display': 'none',
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

      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const nodeData = data.nodes.find(n => n.id === node.id())
        if (!nodeData) return

        cy.elements().removeClass('highlighted highlighted-edge dimmed show-label search-match search-dim')

        const neighborhood = node.neighborhood()
        cy.elements().addClass('dimmed')
        node.removeClass('dimmed').addClass('highlighted')
        neighborhood.removeClass('dimmed')
        neighborhood.edges().addClass('highlighted-edge')
        neighborhood.nodes().addClass('show-label')

        const connections = []
        neighborhood.nodes().forEach(n => {
          if (n.id() === node.id()) return
          const nData = data.nodes.find(nd => nd.id === n.id())
          const edge = cy.edges().filter(e =>
            (e.data('source') === node.id() && e.data('target') === n.id()) ||
            (e.data('target') === node.id() && e.data('source') === n.id())
          )
          const edgeData = edge.length > 0 ? edge[0].data() : null
          const structEdge = data.edges.find(e =>
            (e.source === node.id() && e.target === n.id()) ||
            (e.target === node.id() && e.source === n.id())
          )
          if (nData) {
            connections.push({
              label: nData.label,
              color: nData.type === 'document' ? agencyColor(nData.agency) : nData.color,
              reason: structEdge?.reason,
              edgeType: edgeData?.edgeType,
            })
          }
        })

        setSelectedNode({ ...nodeData, connections })
        updateParam('node', nodeData.id)
      })

      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted highlighted-edge dimmed show-label')
          setSelectedNode(null)
          updateParam('node', null)
        }
      })

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

  // Cross-reference edge toggle
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const existing = cy.edges('[edgeType="xref"]')
    if (showXref && existing.length === 0 && xrefEdges.length > 0) {
      cy.add(xrefEdges)
    } else if (!showXref && existing.length > 0) {
      existing.remove()
    }
  }, [showXref, xrefEdges])

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
        if (layer !== activeLayer) {
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

  // Agency filter
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes('[nodeType="document"]').forEach(n => {
        if (hiddenAgencies.has(n.data('agency'))) {
          n.addClass('agency-hidden')
        } else {
          n.removeClass('agency-hidden')
        }
      })
      cy.edges().forEach(e => {
        const src = cy.getElementById(e.data('source'))
        const tgt = cy.getElementById(e.data('target'))
        if (src.hasClass('agency-hidden') || tgt.hasClass('agency-hidden')) {
          e.addClass('agency-hidden')
        } else {
          e.removeClass('agency-hidden')
        }
      })
    })
  }, [hiddenAgencies])

  // Decade filter
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes('[nodeType="document"]').forEach(n => {
        const decade = n.data('decade')
        if (activeDecade && decade !== activeDecade) {
          n.style('display', 'none')
        } else {
          n.style('display', 'element')
        }
      })
    })
  }, [activeDecade])

  // Search
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      if (!search.trim()) {
        cy.elements().removeClass('search-match search-dim')
        return
      }
      const q = search.toLowerCase()
      const matches = cy.nodes().filter(n => n.data('label').toLowerCase().includes(q))
      if (matches.length > 0) {
        cy.elements().addClass('search-dim')
        matches.removeClass('search-dim').addClass('search-match')
        matches.connectedEdges().removeClass('search-dim')
        matches.neighborhood().nodes().removeClass('search-dim')
      } else {
        cy.elements().removeClass('search-match search-dim')
      }
    })
  }, [search])

  const handleLayerToggle = useCallback((layer) => {
    updateParam('layer', activeLayer === layer ? null : layer)
  }, [activeLayer, updateParam])

  const toggleAgency = useCallback((key) => {
    const next = new URLSearchParams(searchParamsRef.current)
    const updated = new Set(hiddenAgencies)
    if (updated.has(key)) updated.delete(key)
    else updated.add(key)
    if (updated.size > 0) next.set('hide', Array.from(updated).join(','))
    else next.delete('hide')
    setSearchParams(next, { replace: true })
  }, [hiddenAgencies, setSearchParams])

  const handleFit = useCallback(() => {
    cyRef.current?.animate({ fit: { padding: 40 } }, { duration: 300 })
  }, [])

  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({
      zoom: { level: cy.zoom() * 1.4, renderedPosition: { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 } },
    }, { duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({
      zoom: { level: cy.zoom() / 1.4, renderedPosition: { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 } },
    }, { duration: 200 })
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
        <p className="text-slate-500">Failed to load data.</p>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] bg-slate-950 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Filter bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 flex-wrap pointer-events-none">
        <input
          type="text"
          value={search}
          onChange={e => updateParam('q', e.target.value)}
          placeholder="Search documents..."
          className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-44 focus:outline-none focus:border-blue-500/50"
        />
        <div className="pointer-events-auto flex gap-1">
          {AGENCIES.map(a => {
            const hidden = hiddenAgencies.has(a.key)
            return (
              <button
                key={a.key}
                onClick={() => toggleAgency(a.key)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium backdrop-blur border transition-all cursor-pointer ${
                  hidden
                    ? 'bg-slate-900/60 border-slate-700/30 text-slate-600 line-through'
                    : 'bg-slate-900/90 border-slate-700/50 text-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#475569' : a.color }} />
                <span className="hidden sm:inline">{a.label}</span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-auto hidden sm:flex gap-1">
          {DECADES.map(d => (
            <button
              key={d}
              onClick={() => updateParam('decade', activeDecade === d ? null : d)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur border transition-all cursor-pointer ${
                activeDecade === d
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/60 border-slate-700/30 text-slate-500 hover:text-slate-300'
              }`}
            >
              {d}
            </button>
          ))}
          {activeDecade && (
            <button
              onClick={() => updateParam('decade', null)}
              className="px-2 py-1 rounded-md text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              All
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-14 left-3 z-10">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-amber-400 font-mono">{data.metadata?.total_documents || 0}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Docs</div>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-slate-200 font-mono">{data.nodes?.filter(n => n.type === 'org' || n.type === 'layer').length || 0}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Nodes</div>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-slate-200 font-mono">{data.metadata?.total_connections || 0}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Links</div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-1.5">
        <button onClick={handleFit} className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-medium flex items-center gap-1.5 px-3 py-2 cursor-pointer" title="Fit all">
          <span className="text-sm">⊡</span>
          <span className="hidden sm:inline">Reset</span>
        </button>
        <button onClick={handleZoomIn} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom in">+</button>
        <button onClick={handleZoomOut} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom out">&minus;</button>
      </div>

      {/* Layer legend */}
      <LayerLegend
        activeLayer={activeLayer}
        onToggle={handleLayerToggle}
        showXref={showXref}
        onToggleXref={() => updateParam('xref', showXref ? null : '1')}
        xrefCount={graphData?.edges?.length || 0}
      />

      {/* Detail panel */}
      <DetailPanel
        node={selectedNode}
        narratives={narratives}
        onClose={() => {
          setSelectedNode(null)
          updateParam('node', null)
          cyRef.current?.elements().removeClass('highlighted highlighted-edge dimmed show-label')
        }}
      />

      {/* Instructions */}
      {!selectedNode && (
        <div className="absolute bottom-4 right-14 z-10 bg-slate-900/80 backdrop-blur border border-slate-700/40 rounded-lg px-3 py-2 max-w-[220px]">
          <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
            Click any node to explore. Scroll to zoom. Drag to pan.
            {!showXref && <span className="block mt-1 text-cyan-500/60">Toggle cross-refs in the legend to see document-to-document links.</span>}
          </p>
        </div>
      )}
    </div>
  )
}
