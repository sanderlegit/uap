import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { agencyColor, agencyClass, thumbUrl } from '../hooks/useData'
import LegacyTree from '../components/LegacyTree'

const AGENCIES = [
  { key: 'Department of War', label: 'DoW', color: '#3b82f6' },
  { key: 'FBI', label: 'FBI', color: '#ef4444' },
  { key: 'NASA', label: 'NASA', color: '#8b5cf6' },
  { key: 'Department of State', label: 'DoS', color: '#10b981' },
]

const DECADES = ['1940s', '1950s', '1960s', '1970s', '1980s', '2020s']

const EDGE_TYPE_STYLES = {
  content_similarity: { color: '#60a5fa', style: 'solid', label: 'Content Similarity' },
  same_case: { color: '#a78bfa', style: 'dashed', label: 'Same Case' },
  same_series: { color: '#a78bfa', style: 'dashed', label: 'Same Case' },
  related_investigation: { color: '#a78bfa', style: 'dashed', label: 'Same Case' },
  same_agency_release: { color: '#94a3b8', style: 'dotted', label: 'Same Collection' },
  same_agency: { color: '#94a3b8', style: 'dotted', label: 'Same Collection' },
  same_document_type: { color: '#94a3b8', style: 'dotted', label: 'Same Collection' },
  same_era: { color: '#fbbf24', style: 'dashed', label: 'Same Era' },
  same_mission: { color: '#34d399', style: 'solid', label: 'Same Mission' },
  same_program: { color: '#34d399', style: 'solid', label: 'Same Mission' },
  visual_evidence: { color: '#34d399', style: 'solid', label: 'Same Mission' },
  media_pairing: { color: '#34d399', style: 'solid', label: 'Same Mission' },
}

const EDGE_LEGEND = [
  { color: '#60a5fa', label: 'Content Similarity' },
  { color: '#a78bfa', label: 'Same Case' },
  { color: '#94a3b8', label: 'Same Collection' },
  { color: '#fbbf24', label: 'Same Era' },
  { color: '#34d399', label: 'Same Mission' },
]

function DetailPanel({ node, narratives, legacyConnections, onClose, onSelectDoc, onSelectOrg }) {
  if (!node) return null

  const color = agencyColor(node.agency)
  const narrative = narratives?.[String(node.doc_id)]

  return (
    <div className="absolute left-4 top-4 bottom-4 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
        <span className="text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color }}>
          {node.agency}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white w-10 h-10 flex items-center justify-center text-lg leading-none cursor-pointer shrink-0">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <img
          src={thumbUrl(node.doc_id)}
          alt=""
          className="w-full max-w-[200px] rounded mb-3 bg-slate-800"
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <h3 className="text-base font-bold text-slate-100 mb-2 leading-snug">{node.label}</h3>
        {narrative?.hook && (
          <p className="text-xs text-slate-300 leading-relaxed mb-3">{narrative.hook}</p>
        )}
        <div className="space-y-2 mb-3">
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

        {node.connections && node.connections.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-2">
              Related Documents ({node.connections.length})
            </h4>
            <div className="space-y-2">
              {node.connections.map((c, i) => {
                const style = EDGE_TYPE_STYLES[c.edgeType] || {}
                return (
                  <button
                    key={i}
                    onClick={() => onSelectDoc?.(c.docId)}
                    className="w-full text-left text-xs rounded-md px-2 py-1.5 -mx-2 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                      <span className="text-slate-300 group-hover:text-slate-100 flex-1 truncate">{c.label}</span>
                      {c.weight != null && (
                        <span className="text-slate-600 text-[10px] font-mono shrink-0">{(c.weight * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 ml-4">
                      <span className="w-3 h-0.5 rounded shrink-0" style={{ backgroundColor: style.color || '#64748b' }} />
                      <span className="text-[10px]" style={{ color: style.color || '#64748b' }}>{style.label || c.edgeType}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {legacyConnections.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[10px] font-mono tracking-wider uppercase text-amber-500/70 mb-2">
              Legacy Program Connections
            </h4>
            <div className="space-y-2.5">
              {legacyConnections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onSelectOrg?.(c.nodeId)}
                  className="w-full text-left text-xs rounded-md px-2 py-1.5 -mx-2 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-200 font-medium group-hover:text-white">{c.label}</span>
                    <span className="text-slate-600 text-[10px] ml-auto font-mono">{c.weight?.toFixed(2)}</span>
                  </div>
                  {c.reasoning && (
                    <p className="text-[11px] text-slate-400 leading-relaxed ml-4">{c.reasoning}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link
            to={`/documents/${node.doc_id}`}
            state={{ fromGraph: true, nodeId: `doc_${node.doc_id}` }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-wider hover:bg-amber-500/20 transition-colors"
          >
            View Full Document &rarr;
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to={`/timeline?doc=${node.doc_id}${node.decade ? `&decade=${node.decade}` : ''}`}
              className="text-[11px] text-indigo-400/70 hover:text-indigo-400 font-mono py-1"
            >
              Timeline &rarr;
            </Link>
            <Link
              to={`/map?doc=${node.doc_id}`}
              className="text-[11px] text-indigo-400/70 hover:text-indigo-400 font-mono py-1"
            >
              Map &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LegacyWeb() {
  const desktopContainerRef = useRef(null)
  const mobileContainerRef = useRef(null)
  const cyRef = useRef(null)
  const [legacyData, setLegacyData] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [narratives, setNarratives] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredDocId, setHoveredDocId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileTab, setMobileTab] = useState('graph')

  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') || ''
  const activeDecade = searchParams.get('decade') || null
  const selectedLayer = searchParams.get('layer') || null
  const hiddenAgencies = useMemo(() => {
    const v = searchParams.get('hide')
    return v ? new Set(v.split(',')) : new Set()
  }, [searchParams])
  const selectedOrgs = useMemo(() => {
    const v = searchParams.get('org')
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
      setLegacyData(lw)
      setGraphData(g)
      setNarratives(n)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const orgToDocIds = useMemo(() => {
    if (!legacyData) return new Map()
    const map = new Map()
    legacyData.edges.filter(e => e.type === 'document').forEach(e => {
      const docId = parseInt(e.source.replace('doc_', ''), 10)
      if (!map.has(e.target)) map.set(e.target, new Set())
      map.get(e.target).add(docId)
    })
    return map
  }, [legacyData])

  const docToOrgIds = useMemo(() => {
    if (!legacyData) return new Map()
    const map = new Map()
    legacyData.edges.filter(e => e.type === 'document').forEach(e => {
      const docId = parseInt(e.source.replace('doc_', ''), 10)
      if (!map.has(docId)) map.set(docId, new Set())
      map.get(docId).add(e.target)
    })
    return map
  }, [legacyData])

  const orgFilteredDocIds = useMemo(() => {
    const activeOrgs = new Set(selectedOrgs)
    if (selectedLayer && legacyData) {
      legacyData.nodes
        .filter(n => n.type === 'org' && n.layer === selectedLayer)
        .forEach(n => activeOrgs.add(n.id))
    }
    if (activeOrgs.size === 0) return null
    const result = new Set()
    for (const orgId of activeOrgs) {
      const docs = orgToDocIds.get(orgId)
      if (docs) docs.forEach(d => result.add(d))
    }
    return result
  }, [selectedOrgs, selectedLayer, orgToDocIds, legacyData])

  const highlightedOrgs = useMemo(() => {
    const docId = hoveredDocId ?? selectedNode?.doc_id
    if (docId == null) return new Set()
    return docToOrgIds.get(docId) || new Set()
  }, [hoveredDocId, selectedNode, docToOrgIds])

  const selectedDocLegacyConns = useMemo(() => {
    if (!selectedNode || !legacyData) return []
    const docNodeId = `doc_${selectedNode.doc_id}`
    const nodeMap = new Map(legacyData.nodes.map(n => [n.id, n]))
    const narrative = narratives?.[String(selectedNode.doc_id)]
    const narrativeConns = narrative?.legacy_program_connections || []
    return legacyData.edges
      .filter(e => e.source === docNodeId && e.type === 'document')
      .map(e => {
        const node = nodeMap.get(e.target)
        if (!node) return null
        const nc = narrativeConns.find(c => c.node_id === node.id)
        return {
          nodeId: node.id,
          label: node.label,
          color: node.color,
          layer: node.layer,
          weight: e.weight,
          reasoning: nc?.reasoning || (e.reason || '').split(';').map(r => r.trim()).filter(Boolean).join('. '),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
  }, [selectedNode, legacyData, narratives])

  // Resize Cytoscape when switching to graph tab on mobile
  useEffect(() => {
    if (mobileTab === 'graph' && cyRef.current) {
      cyRef.current.resize()
      cyRef.current.fit(undefined, 40)
    }
  }, [mobileTab])

  // Build Cytoscape graph
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    const container = isMobile ? mobileContainerRef.current : desktopContainerRef.current
    if (!graphData || !legacyData || !container) return

    let cancelled = false

    import('cytoscape').then(mod => {
      if (cancelled) return
      const cytoscape = mod.default || mod

      const elements = []

      const docNodes = legacyData.nodes.filter(n => n.type === 'document')
      const connectionCounts = {}
      graphData.edges.forEach(e => {
        connectionCounts[e.source_id] = (connectionCounts[e.source_id] || 0) + 1
        connectionCounts[e.target_id] = (connectionCounts[e.target_id] || 0) + 1
      })

      docNodes.forEach(n => {
        const conns = connectionCounts[n.doc_id] || 0
        const size = Math.max(20, Math.min(44, 20 + conns * 2.5))
        const shortLabel = (n.label || '').split(',')[0].replace(/^(DOW|FBI|NASA|DoS)-?(UAP-?)?/i, '').trim().slice(0, 28)
        elements.push({
          group: 'nodes',
          data: {
            id: `doc_${n.doc_id}`,
            label: shortLabel || n.label,
            fullLabel: n.label,
            nodeType: 'document',
            color: agencyColor(n.agency),
            nodeSize: size,
            bgImage: `/data/thumbnails/${n.doc_id}_thumb.jpg`,
            docId: n.doc_id,
            agency: n.agency || '',
            decade: n.decade || '',
            pages: n.pages || 0,
            has_redaction: n.has_redaction || false,
          },
        })
      })

      graphData.edges.forEach((e, i) => {
        elements.push({
          group: 'edges',
          data: {
            id: `ge_${i}`,
            source: `doc_${e.source_id}`,
            target: `doc_${e.target_id}`,
            edgeType: e.edge_type,
            weight: e.weight || 0.5,
          },
        })
      })

      const cy = cytoscape({
        container,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              'background-opacity': 0.15,
              'background-image': 'data(bgImage)',
              'background-fit': 'cover',
              'background-clip': 'node',
              'background-image-opacity': 0.85,
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'shape': 'round-rectangle',
              'corner-radius': 3,
              'label': '',
              'border-width': 2,
              'border-color': 'data(color)',
              'border-opacity': 0.7,
            },
          },
          {
            selector: 'node.no-thumb',
            style: {
              'background-image-opacity': 0,
              'background-opacity': 0.8,
              'shape': 'ellipse',
            },
          },
          {
            selector: 'edge[edgeType="content_similarity"]',
            style: {
              'line-color': '#60a5fa',
              'width': 'mapData(weight, 0, 1, 0.5, 2.5)',
              'curve-style': 'bezier',
              'opacity': 0.25,
            },
          },
          {
            selector: 'edge[edgeType="same_case"], edge[edgeType="same_series"], edge[edgeType="related_investigation"]',
            style: {
              'line-color': '#a78bfa',
              'width': 'mapData(weight, 0, 1, 0.5, 2.5)',
              'curve-style': 'bezier',
              'opacity': 0.3,
              'line-style': 'dashed',
            },
          },
          {
            selector: 'edge[edgeType="same_agency_release"], edge[edgeType="same_agency"], edge[edgeType="same_document_type"]',
            style: {
              'line-color': '#94a3b8',
              'width': 'mapData(weight, 0, 1, 0.3, 1.5)',
              'curve-style': 'bezier',
              'opacity': 0.15,
              'line-style': 'dotted',
            },
          },
          {
            selector: 'edge[edgeType="same_era"]',
            style: {
              'line-color': '#fbbf24',
              'width': 'mapData(weight, 0, 1, 0.3, 1.5)',
              'curve-style': 'bezier',
              'opacity': 0.2,
              'line-style': 'dashed',
            },
          },
          {
            selector: 'edge[edgeType="same_mission"], edge[edgeType="same_program"], edge[edgeType="visual_evidence"], edge[edgeType="media_pairing"]',
            style: {
              'line-color': '#34d399',
              'width': 'mapData(weight, 0, 1, 0.8, 2.5)',
              'curve-style': 'bezier',
              'opacity': 0.35,
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
            selector: '.filtered-out',
            style: {
              'opacity': 0.05,
            },
          },
          {
            selector: '.agency-hidden',
            style: {
              'display': 'none',
            },
          },
          {
            selector: 'node.show-label',
            style: {
              'label': 'data(label)',
              'color': '#e2e8f0',
              'font-size': '11px',
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'text-outline-width': 2,
              'text-outline-color': '#020617',
              'text-wrap': 'wrap',
              'text-max-width': '140px',
            },
          },
          {
            selector: 'node.zoom-label',
            style: {
              'label': 'data(label)',
              'color': '#94a3b8',
              'font-size': '9px',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'text-outline-width': 1.5,
              'text-outline-color': '#020617',
              'text-max-width': '100px',
              'text-wrap': 'ellipsis',
            },
          },
        ],
        layout: {
          name: 'cose',
          idealEdgeLength: 130,
          nodeOverlap: 20,
          nodeRepulsion: 12000,
          edgeElasticity: 60,
          gravity: 0.2,
          numIter: 1200,
          animate: true,
          animationDuration: 1500,
          animationEasing: 'ease-out-cubic',
          randomize: true,
        },
        autoungrabify: true,
        minZoom: 0.15,
        maxZoom: 4,
        wheelSensitivity: 0.3,
      })

      cy.on('tap', 'node', (evt) => {
        const node = evt.target
        const docId = node.data('docId')
        const nodeData = legacyData.nodes.find(n => n.doc_id === docId)
        if (!nodeData) return

        cy.elements().removeClass('highlighted highlighted-edge dimmed show-label search-match search-dim')

        const neighborhood = node.neighborhood()
        cy.elements().addClass('dimmed')
        node.removeClass('dimmed').addClass('highlighted show-label')
        neighborhood.removeClass('dimmed')
        neighborhood.edges().addClass('highlighted-edge')
        neighborhood.nodes().addClass('show-label')

        const connections = []
        neighborhood.nodes().forEach(n => {
          if (n.id() === node.id()) return
          const nDocId = n.data('docId')
          const nData = legacyData.nodes.find(nd => nd.doc_id === nDocId)
          const edge = cy.edges().filter(e =>
            (e.data('source') === node.id() && e.data('target') === n.id()) ||
            (e.data('target') === node.id() && e.data('source') === n.id())
          )
          const edgeData = edge.length > 0 ? edge[0].data() : null
          if (nData) {
            connections.push({
              docId: nDocId,
              label: nData.label,
              color: agencyColor(nData.agency),
              edgeType: edgeData?.edgeType,
              weight: edgeData?.weight,
            })
          }
        })

        setSelectedNode({ ...nodeData, connections })
        updateParam('node', `doc_${docId}`)
        if (window.innerWidth < 768) setMobileTab('doc')
      })

      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted highlighted-edge dimmed show-label')
          setSelectedNode(null)
          setHoveredDocId(null)
          updateParam('node', null)
        }
      })

      cy.on('zoom', () => {
        const zoom = cy.zoom()
        cy.batch(() => {
          if (zoom > 1.2) {
            cy.nodes().not('.dimmed,.filtered-out,.agency-hidden').addClass('zoom-label')
          } else {
            cy.nodes().removeClass('zoom-label')
          }
        })
      })

      cy.on('mouseover', 'node', (evt) => {
        container.style.cursor = 'pointer'
        const node = evt.target
        node.addClass('show-label')
        setHoveredDocId(node.data('docId'))
      })

      cy.on('mouseout', 'node', (evt) => {
        container.style.cursor = 'default'
        const node = evt.target
        if (!node.hasClass('highlighted') && !node.hasClass('zoom-label')) {
          node.removeClass('show-label')
        }
        setHoveredDocId(null)
      })

      cy.ready(() => {
        cy.nodes().forEach(node => {
          const img = new Image()
          img.onerror = () => node.addClass('no-thumb')
          img.src = node.data('bgImage')
        })
      })

      cyRef.current = cy
    })

    return () => {
      cancelled = true
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
      }
    }
  }, [graphData, legacyData])

  // Org/layer filter
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      if (!orgFilteredDocIds) {
        cy.nodes().removeClass('filtered-out')
        cy.edges().removeClass('filtered-out')
      } else {
        cy.nodes().forEach(n => {
          if (orgFilteredDocIds.has(n.data('docId'))) {
            n.removeClass('filtered-out')
          } else {
            n.addClass('filtered-out')
          }
        })
        cy.edges().forEach(e => {
          const src = cy.getElementById(e.data('source'))
          const tgt = cy.getElementById(e.data('target'))
          if (src.hasClass('filtered-out') || tgt.hasClass('filtered-out')) {
            e.addClass('filtered-out')
          } else {
            e.removeClass('filtered-out')
          }
        })
      }
    })
  }, [orgFilteredDocIds])

  // Agency filter
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().forEach(n => {
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
      cy.nodes().forEach(n => {
        if (activeDecade && n.data('decade') !== activeDecade) {
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

  const handleToggleOrg = useCallback((orgId) => {
    const next = new URLSearchParams(searchParamsRef.current)
    const updated = new Set(selectedOrgs)
    if (updated.has(orgId)) updated.delete(orgId)
    else updated.add(orgId)
    if (updated.size > 0) next.set('org', Array.from(updated).join(','))
    else next.delete('org')
    setSearchParams(next, { replace: true })
  }, [selectedOrgs, setSearchParams])

  const handleSelectLayer = useCallback((layerId) => {
    updateParam('layer', layerId)
  }, [updateParam])

  const handleClearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParamsRef.current)
    next.delete('org')
    next.delete('layer')
    setSearchParams(next, { replace: true })
    cyRef.current?.batch(() => {
      cyRef.current.nodes().removeClass('filtered-out')
      cyRef.current.edges().removeClass('filtered-out')
    })
  }, [setSearchParams])

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
    const el = cy.container()
    cy.animate({
      zoom: { level: cy.zoom() * 1.4, renderedPosition: { x: el.clientWidth / 2, y: el.clientHeight / 2 } },
    }, { duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const el = cy.container()
    cy.animate({
      zoom: { level: cy.zoom() / 1.4, renderedPosition: { x: el.clientWidth / 2, y: el.clientHeight / 2 } },
    }, { duration: 200 })
  }, [])

  const handleSelectDoc = useCallback((docId) => {
    const cy = cyRef.current
    if (!cy) return
    const target = cy.getElementById(`doc_${docId}`)
    if (target.length > 0) {
      target.emit('tap')
      cy.animate({ center: { eles: target }, zoom: cy.zoom() }, { duration: 300 })
    }
  }, [])

  const activeFilterCount = hiddenAgencies.size + (activeDecade ? 1 : 0) + selectedOrgs.size + (selectedLayer ? 1 : 0) + (search ? 1 : 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-mono tracking-wider">Mapping the network...</p>
        </div>
      </div>
    )
  }

  if (!legacyData || !graphData) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-7.5rem)]">
        <p className="text-slate-500">Failed to load data.</p>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-7.5rem-3.5rem)] md:h-[calc(100dvh-7.5rem)] bg-slate-950 overflow-hidden flex flex-col md:flex-row">

      {/* ═══ DESKTOP LAYOUT ═══ */}

      {/* Left: Document Network Graph (desktop: always visible) */}
      <div className="hidden md:block flex-1 relative">
        <div ref={desktopContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Desktop filter bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 flex-wrap pointer-events-none">
          <input
            type="text"
            value={search}
            onChange={e => updateParam('q', e.target.value)}
            placeholder="Search documents..."
            className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 w-40 focus:outline-none focus:border-blue-500/50"
          />
          <div className="pointer-events-auto flex gap-1">
            {AGENCIES.map(a => {
              const hidden = hiddenAgencies.has(a.key)
              return (
                <button
                  key={a.key}
                  onClick={() => toggleAgency(a.key)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium backdrop-blur border transition-all cursor-pointer ${
                    hidden
                      ? 'bg-slate-900/60 border-slate-700/30 text-slate-600 line-through'
                      : 'bg-slate-900/90 border-slate-700/50 text-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#475569' : a.color }} />
                  {a.label}
                </button>
              )
            })}
          </div>
          <div className="pointer-events-auto flex gap-1 overflow-x-auto">
            {DECADES.map(d => (
              <button
                key={d}
                onClick={() => updateParam('decade', activeDecade === d ? null : d)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-medium backdrop-blur border transition-all cursor-pointer shrink-0 ${
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
                className="px-2 py-1.5 rounded-md text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer shrink-0"
              >
                All
              </button>
            )}
          </div>
        </div>

        {/* Edge legend */}
        <div className="absolute left-3 bottom-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Edge Types</p>
          {EDGE_LEGEND.map(cfg => (
            <div key={cfg.label} className="flex items-center gap-2 py-0.5">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: cfg.color }} />
              <span className="text-[11px] text-slate-400">{cfg.label}</span>
            </div>
          ))}
          <div className="border-t border-slate-700/50 mt-1.5 pt-1.5">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-slate-500">{graphData.nodes.length} docs</span>
              <span className="text-slate-600">&middot;</span>
              <span className="text-slate-500">{graphData.edges.length} links</span>
            </div>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-1.5">
          <button onClick={handleFit} className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-medium flex items-center gap-1.5 px-3 py-2 cursor-pointer" title="Fit all">
            <span className="text-sm">&oplus;</span> Reset
          </button>
          <button onClick={handleZoomIn} className="w-10 h-10 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom in">+</button>
          <button onClick={handleZoomOut} className="w-10 h-10 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-bold flex items-center justify-center cursor-pointer" title="Zoom out">&minus;</button>
        </div>

        {/* Desktop detail panel */}
        <DetailPanel
          node={selectedNode}
          narratives={narratives}
          legacyConnections={selectedDocLegacyConns}
          onClose={() => {
            setSelectedNode(null)
            setHoveredDocId(null)
            updateParam('node', null)
            cyRef.current?.elements().removeClass('highlighted highlighted-edge dimmed show-label')
          }}
          onSelectDoc={handleSelectDoc}
          onSelectOrg={handleToggleOrg}
        />

        {/* Instructions */}
        {!selectedNode && (
          <div className="absolute bottom-4 right-14 z-10 bg-slate-900/80 backdrop-blur border border-slate-700/40 rounded-lg px-3 py-2 max-w-[200px]">
            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
              Click a document to explore. Hover to see Legacy Program connections. Use the tree to filter by organization.
            </p>
          </div>
        )}
      </div>

      {/* Right: Legacy Program Tree Sidebar (desktop) */}
      <div className="hidden md:flex flex-col border-l border-slate-800 bg-slate-950 w-64 lg:w-72">
        <LegacyTree
          data={legacyData}
          selectedOrgs={selectedOrgs}
          onToggleOrg={handleToggleOrg}
          onSelectLayer={handleSelectLayer}
          selectedLayer={selectedLayer}
          highlightedOrgs={highlightedOrgs}
          onClear={handleClearFilters}
        />
      </div>

      {/* ═══ MOBILE LAYOUT ═══ */}

      {/* Mobile: content area — all tabs stacked */}
      <div className="md:hidden flex-1 relative overflow-hidden">
        {/* Graph — always in DOM so Cytoscape can init and measure */}
        <div className={`absolute inset-0 ${mobileTab === 'graph' ? 'z-10' : 'z-0 pointer-events-none'}`}>
          <div ref={mobileContainerRef} className="absolute inset-0 w-full h-full" />

          {mobileTab === 'graph' && (
            <>
              <div className="absolute top-2 right-2 z-20 flex gap-1">
                <button onClick={handleFit} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer">&oplus;</button>
                <button onClick={handleZoomIn} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 text-sm font-bold flex items-center justify-center cursor-pointer">+</button>
                <button onClick={handleZoomOut} className="w-9 h-9 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg text-slate-300 text-sm font-bold flex items-center justify-center cursor-pointer">&minus;</button>
              </div>

              <div className="absolute top-2 left-2 z-20 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] text-slate-400 font-mono">{graphData.nodes.length} docs &middot; {graphData.edges.length} links</span>
              </div>
            </>
          )}
        </div>

        {/* Program tree tab */}
        <div className={`absolute inset-0 overflow-y-auto ${mobileTab === 'tree' ? 'z-10' : 'z-0 pointer-events-none hidden'}`}>
          <LegacyTree
            data={legacyData}
            selectedOrgs={selectedOrgs}
            onToggleOrg={handleToggleOrg}
            onSelectLayer={handleSelectLayer}
            selectedLayer={selectedLayer}
            highlightedOrgs={highlightedOrgs}
            onClear={handleClearFilters}
          />
        </div>

        {/* Filters tab */}
        <div className={`absolute inset-0 overflow-y-auto ${mobileTab === 'filters' ? 'z-10' : 'z-0 pointer-events-none hidden'}`}>
          <div className="p-4 space-y-5">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={e => updateParam('q', e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">Agencies</label>
              <div className="flex flex-wrap gap-2">
                {AGENCIES.map(a => {
                  const hidden = hiddenAgencies.has(a.key)
                  return (
                    <button
                      key={a.key}
                      onClick={() => toggleAgency(a.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        hidden
                          ? 'bg-slate-900 border-slate-700/30 text-slate-600 line-through'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#475569' : a.color }} />
                      {a.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">Decade</label>
              <div className="flex flex-wrap gap-2">
                {DECADES.map(d => (
                  <button
                    key={d}
                    onClick={() => updateParam('decade', activeDecade === d ? null : d)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      activeDecade === d
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-700/30 text-slate-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                {activeDecade && (
                  <button
                    onClick={() => updateParam('decade', null)}
                    className="px-3 py-2 rounded-lg text-xs text-slate-500 border border-slate-700/30 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">Edge Types</label>
              <div className="flex flex-wrap gap-3">
                {EDGE_LEGEND.map(cfg => (
                  <div key={cfg.label} className="flex items-center gap-2">
                    <span className="w-5 h-0.5 rounded" style={{ backgroundColor: cfg.color }} />
                    <span className="text-xs text-slate-400">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  handleClearFilters()
                  const next = new URLSearchParams(searchParamsRef.current)
                  next.delete('hide')
                  next.delete('q')
                  next.delete('decade')
                  next.delete('org')
                  next.delete('layer')
                  setSearchParams(next, { replace: true })
                }}
                className="w-full text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Document tab */}
        <div className={`absolute inset-0 overflow-y-auto bg-slate-950 ${mobileTab === 'doc' ? 'z-10' : 'z-0 pointer-events-none hidden'}`}>
          {selectedNode ? (
            <div className="p-4">
              <button
                onClick={() => setMobileTab('graph')}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 cursor-pointer"
              >
                &larr; Back to network
              </button>

              {/* Preview card */}
              <div className="flex gap-3 mb-4">
                <img
                  src={thumbUrl(selectedNode.doc_id)}
                  alt=""
                  className="w-20 h-auto rounded bg-slate-800 shrink-0"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-mono tracking-[0.15em] uppercase block mb-1" style={{ color: agencyColor(selectedNode.agency) }}>
                    {selectedNode.agency}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 leading-snug mb-1">{selectedNode.label}</h3>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {selectedNode.decade && <span>{selectedNode.decade}</span>}
                    {selectedNode.pages > 0 && <span>{selectedNode.pages} pg</span>}
                    {selectedNode.has_redaction && <span className="text-red-400">Redacted</span>}
                  </div>
                </div>
              </div>

              {narratives?.[String(selectedNode.doc_id)]?.hook && (
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{narratives[String(selectedNode.doc_id)].hook}</p>
              )}

              <Link
                to={`/documents/${selectedNode.doc_id}`}
                state={{ fromGraph: true, nodeId: `doc_${selectedNode.doc_id}` }}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors mb-5"
              >
                Open Full Document &rarr;
              </Link>

              {/* Graph connections — unique to this view */}
              {selectedNode.connections && selectedNode.connections.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] font-mono tracking-wider uppercase text-slate-500 mb-2">
                    Network Connections ({selectedNode.connections.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedNode.connections.map((c, i) => {
                      const style = EDGE_TYPE_STYLES[c.edgeType] || {}
                      return (
                        <button
                          key={i}
                          onClick={() => handleSelectDoc(c.docId)}
                          className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-slate-800/60 transition-colors cursor-pointer group flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                          <span className="text-slate-300 group-hover:text-slate-100 flex-1 truncate">{c.label}</span>
                          <span className="w-3 h-0.5 rounded shrink-0" style={{ backgroundColor: style.color || '#64748b' }} />
                          {c.weight != null && (
                            <span className="text-slate-600 text-[10px] font-mono shrink-0">{(c.weight * 100).toFixed(0)}%</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedDocLegacyConns.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] font-mono tracking-wider uppercase text-amber-500/70 mb-2">
                    Legacy Program Connections
                  </h4>
                  <div className="space-y-2">
                    {selectedDocLegacyConns.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { handleToggleOrg(c.nodeId); setMobileTab('tree') }}
                        className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-slate-200 group-hover:text-white flex-1">{c.label}</span>
                          <span className="text-slate-600 text-[10px] font-mono">{c.weight?.toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                <Link
                  to={`/timeline?doc=${selectedNode.doc_id}${selectedNode.decade ? `&decade=${selectedNode.decade}` : ''}`}
                  className="text-[11px] text-indigo-400/70 hover:text-indigo-400 font-mono py-1"
                >
                  Timeline &rarr;
                </Link>
                <Link
                  to={`/map?doc=${selectedNode.doc_id}`}
                  className="text-[11px] text-indigo-400/70 hover:text-indigo-400 font-mono py-1"
                >
                  Map &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full border-2 border-slate-700 flex items-center justify-center mb-3">
                <span className="text-slate-600 text-lg">?</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">No document selected</p>
              <p className="text-xs text-slate-600">Tap a node on the Network tab to inspect it here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Bottom tab bar */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-900/95 backdrop-blur shrink-0">
        {[
          { key: 'graph', label: 'Network' },
          { key: 'doc', label: 'Document', disabled: !selectedNode },
          { key: 'tree', label: 'Program' },
          { key: 'filters', label: 'Filters' },
        ].map(({ key, label, disabled }) => (
          <button
            key={key}
            onClick={() => !disabled && setMobileTab(key)}
            className={`flex-1 py-3 text-xs font-medium text-center transition-colors relative ${
              disabled
                ? 'text-slate-700 cursor-default'
                : mobileTab === key
                  ? 'text-amber-400 cursor-pointer'
                  : 'text-slate-500 cursor-pointer'
            }`}
          >
            {label}
            {key === 'filters' && activeFilterCount > 0 && (
              <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full bg-amber-500/80 text-[9px] text-slate-950 font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {key === 'doc' && selectedNode && mobileTab !== 'doc' && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-amber-400" />
            )}
            {mobileTab === key && (
              <span className="absolute bottom-0 inset-x-4 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
