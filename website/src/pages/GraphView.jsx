import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import cytoscape from 'cytoscape'
import { useGraph, agencyColor, agencyClass } from '../hooks/useData'

const GRAPH_DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '2020s']

const AGENCIES = [
  { key: 'Department of War', label: 'Dept. of War', color: '#3b82f6' },
  { key: 'FBI', label: 'FBI', color: '#ef4444' },
  { key: 'NASA', label: 'NASA', color: '#8b5cf6' },
  { key: 'Department of State', label: 'Dept. of State', color: '#10b981' },
]

function Spinner() {
  return (
    <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Building network graph&hellip;</p>
      </div>
    </div>
  )
}

export default function GraphView() {
  const graph = useGraph()
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [narratives, setNarratives] = useState(null)

  const selectedNodeId = searchParams.get('node') || null
  const search = searchParams.get('search') || ''
  const hiddenAgencies = useMemo(() => {
    const v = searchParams.get('agency')
    return v ? new Set(v.split(',')) : new Set()
  }, [searchParams])
  const activeDecade = searchParams.get('decade') || null

  const selected = useMemo(() => {
    if (!graph || !selectedNodeId) return null
    const node = graph.nodes.find(n => String(n.id) === selectedNodeId)
    if (!node) return null
    return {
      id: String(node.id),
      label: node.label,
      agency: node.agency,
      decade: node.decade,
      connections: node.connections || 0,
    }
  }, [graph, selectedNodeId])

  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams

  const setSelected = useCallback((sel) => {
    const next = new URLSearchParams(searchParamsRef.current)
    if (sel) next.set('node', sel.id)
    else next.delete('node')
    setSearchParams(next, { replace: true })
  }, [setSearchParams])

  const setSearch = useCallback((val) => {
    const next = new URLSearchParams(searchParamsRef.current)
    if (val.trim()) next.set('search', val)
    else next.delete('search')
    setSearchParams(next, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    fetch('/data/doc_narratives.json')
      .then(r => r.json())
      .then(setNarratives)
      .catch(() => {})
  }, [])

  const handleFit = useCallback(() => {
    if (cyRef.current) cyRef.current.animate({ fit: { padding: 40 } }, { duration: 300 })
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

  const hiddenAgenciesRef = useRef(hiddenAgencies)
  hiddenAgenciesRef.current = hiddenAgencies

  const toggleAgency = useCallback((key) => {
    const next = new URLSearchParams(searchParamsRef.current)
    const updated = new Set(hiddenAgenciesRef.current)
    if (updated.has(key)) updated.delete(key)
    else updated.add(key)
    if (updated.size > 0) next.set('agency', Array.from(updated).join(','))
    else next.delete('agency')
    setSearchParams(next, { replace: true })
  }, [setSearchParams])


  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().forEach(n => {
        const agencyHidden = hiddenAgencies.has(n.data('agency'))
        const decadeHidden = activeDecade && n.data('decade') !== activeDecade
        n.style('display', (agencyHidden || decadeHidden) ? 'none' : 'element')
      })
      cy.edges().forEach(e => {
        const hidden = e.source().style('display') === 'none' || e.target().style('display') === 'none'
        e.style('display', hidden ? 'none' : 'element')
      })
    })
  }, [hiddenAgencies, activeDecade])

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
            'background-opacity': 0.85,
            label: 'data(label)',
            'font-size': 10,
            'font-family': 'ui-sans-serif, system-ui, sans-serif',
            'text-wrap': 'ellipsis',
            'text-max-width': 120,
            color: '#e2e8f0',
            'text-outline-color': '#0f172a',
            'text-outline-width': 3,
            'text-valign': 'bottom',
            'text-margin-y': 5,
            shape: 'ellipse',
            width: 'mapData(connections, 0, 20, 24, 52)',
            height: 'mapData(connections, 0, 20, 24, 52)',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.3,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#64748b',
            width: 'mapData(weight, 1, 10, 1, 4)',
            opacity: 0.5,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#f59e0b',
            'border-opacity': 1,
          },
        },
        {
          selector: 'node.hover-hl',
          style: {
            'border-width': 3,
            'border-color': '#f59e0b',
            'border-opacity': 0.9,
            'z-index': 10,
          },
        },
        {
          selector: 'node.hover-nb',
          style: {
            opacity: 1,
            'z-index': 5,
          },
        },
        {
          selector: 'node.hover-dim',
          style: {
            opacity: 0.12,
            'text-opacity': 0,
          },
        },
        {
          selector: 'edge.hover-hl',
          style: {
            'line-color': '#94a3b8',
            opacity: 0.8,
            'z-index': 10,
          },
        },
        {
          selector: 'edge.hover-dim',
          style: {
            opacity: 0.04,
          },
        },
        {
          selector: 'node.search-match',
          style: {
            'border-width': 3,
            'border-color': '#22d3ee',
            'border-opacity': 1,
            'z-index': 20,
          },
        },
        {
          selector: '.search-dim',
          style: {
            opacity: 0.08,
            'text-opacity': 0,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: 18000,
        idealEdgeLength: 140,
        edgeElasticity: 100,
        gravity: 0.25,
        numIter: 1000,
        nodeDimensionsIncludeLabels: true,
        padding: 50,
      },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    })

    cyRef.current = cy

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target
      const hood = node.closedNeighborhood()
      cy.batch(() => {
        cy.elements().not(hood).addClass('hover-dim')
        node.addClass('hover-hl')
        hood.nodes().not(node).addClass('hover-nb')
        hood.edges().addClass('hover-hl')
      })
    })

    cy.on('mouseout', 'node', () => {
      cy.batch(() => {
        cy.elements().removeClass('hover-dim hover-hl hover-nb')
      })
    })

    cy.on('tap', 'node', (evt) => {
      const n = evt.target
      setSelected({
        id: n.data('id'),
        label: n.data('label'),
        agency: n.data('agency'),
        decade: n.data('decade'),
        connections: n.data('connections'),
      })
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelected(null)
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [graph])

  if (!graph) return <Spinner />

  return (
    <div className="relative h-[calc(100dvh-7.5rem)]">
      <div ref={containerRef} className="w-full h-full bg-slate-950" />

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-14 z-10 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-1">
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
        <div className="hidden sm:flex gap-1">
          {GRAPH_DECADES.map(d => (
            <button
              key={d}
              onClick={() => { const next = new URLSearchParams(searchParams); if (activeDecade === d) next.delete('decade'); else next.set('decade', d); setSearchParams(next, { replace: true }) }}
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
              onClick={() => { const next = new URLSearchParams(searchParams); next.delete('decade'); setSearchParams(next, { replace: true }) }}
              className="px-2 py-1 rounded-md text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              All
            </button>
          )}
        </div>
      </div>

      {/* Stats badge + guide */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2 max-w-[180px]">
        <p className="text-[10px] text-slate-500 tabular-nums">{graph.nodes.length} nodes &middot; {graph.edges.length} edges</p>
        <p className="text-[9px] text-slate-600 mt-1 leading-snug">Colors = agency. Edges = shared references or overlapping events. Click any node for details.</p>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-1.5">
        <button onClick={handleFit} className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-medium flex items-center gap-1.5 px-3 py-2 cursor-pointer" title="Fit all" aria-label="Fit graph to screen">
          <span className="text-sm">⊡</span>
          <span className="hidden sm:inline">Reset</span>
        </button>
        <button onClick={handleZoomIn} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={handleZoomOut} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom out" aria-label="Zoom out">&minus;</button>
      </div>

      {/* Selected node preview panel */}
      {selected && (
        <div className="absolute bottom-6 left-3 z-10 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-lg p-4 max-w-[340px] shadow-xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-3">{selected.label}</h3>
            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer text-lg leading-none flex-shrink-0">&times;</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
            {selected.agency && <span className={`agency-badge ${agencyClass(selected.agency)}`}>{selected.agency}</span>}
            {selected.decade && <span className="text-slate-500">{selected.decade}</span>}
            <span className="text-slate-500">{selected.connections} connections</span>
          </div>
          {narratives?.[selected.id]?.hook && (
            <p className="text-xs text-slate-300 leading-relaxed mb-3">{narratives[selected.id].hook}</p>
          )}
          <div className="flex items-center gap-3">
            <Link
              to={`/documents/${selected.id}`}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Read Full Document &rarr;
            </Link>
            <Link
              to={`/timeline?doc=${selected.id}${selected.decade ? `&decade=${selected.decade}` : ''}`}
              className="text-[10px] text-indigo-400/70 hover:text-indigo-400"
            >
              Timeline
            </Link>
            <Link
              to={`/map?doc=${selected.id}`}
              className="text-[10px] text-indigo-400/70 hover:text-indigo-400"
            >
              Map
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
