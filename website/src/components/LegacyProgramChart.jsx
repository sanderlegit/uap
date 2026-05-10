import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const LAYER_COLORS = ['#3b82f6', '#f59e0b', '#ef4444']

function NodeLinks({ node }) {
  if (!node.search && !node.lat) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {node.lat != null && (
        <Link to={`/map?lat=${node.lat}&lng=${node.lng}&zoom=${node.zoom || 13}`}
          className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">
          <span>◎</span><span>Map</span>
        </Link>
      )}
      {node.search && (
        <>
          <Link to={`/search?q=${encodeURIComponent(node.search)}`}
            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
            <span>◫</span><span>Docs</span>
          </Link>
          <Link to={`/entities?q=${encodeURIComponent(node.search)}`}
            className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors">
            <span>▣</span><span>Entities</span>
          </Link>
        </>
      )}
    </div>
  )
}

function NodeDetail({ node, color }) {
  return (
    <div className="px-3 pb-3 space-y-2">
      <p className="text-xs text-slate-400 leading-relaxed">{node.detail}</p>
      {(node.evidence || node.connections?.length > 0) && (
        <div className="lg:flex lg:items-baseline lg:flex-wrap lg:gap-x-4 lg:gap-y-1.5 space-y-1.5 lg:space-y-0">
          {node.evidence && (
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Evidence </span>
              <span className="text-xs text-slate-400">{node.evidence}</span>
            </div>
          )}
          {node.connections?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Connections</span>
              {node.connections.map((c, i) => (
                <span key={i} className="text-[11px] text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.5">{c}</span>
              ))}
            </div>
          )}
          <div className="shrink-0"><NodeLinks node={node} /></div>
        </div>
      )}
      {!node.evidence && !node.connections?.length && <NodeLinks node={node} />}
    </div>
  )
}

function ChartNode({ node, color, isExpanded, onToggle }) {
  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${
        isExpanded
          ? 'border-slate-600/60 bg-slate-800/40'
          : 'border-slate-700/50 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800/60'
      }`}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-200 leading-snug">{node.name}</div>
          {node.role && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{node.role}</div>}
        </div>
        <span className={`text-slate-500 text-[10px] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#9662;</span>
      </button>
      {isExpanded && <NodeDetail node={node} color={color} />}
    </div>
  )
}

function LayerSection({ layer, index, expanded, onToggle }) {
  const color = LAYER_COLORS[index]
  const sectionId = `layer-${index + 1}`

  return (
    <div id={sectionId}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {index + 1}
        </div>
        <h3 className="text-sm font-bold text-slate-200">{layer.name}</h3>
        <span className="text-xs text-slate-500">{layer.lead}</span>
      </div>

      <div className="space-y-3">
        {layer.agencies.map((agency, ai) => {
          const agencySlug = agency.name.split(/[\s—]/)[0].toLowerCase().replace(/[^a-z]/g, '')
          return (
          <div key={ai} id={`${sectionId}-${agencySlug}`}>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">{agency.name}</div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 items-start">
              {agency.nodes.map((node, ni) => (
                <div key={ni} className={expanded.has(node.name) ? 'sm:col-span-2 lg:col-span-3' : ''}>
                  <ChartNode
                    node={node}
                    color={color}
                    isExpanded={expanded.has(node.name)}
                    onToggle={() => onToggle(node.name)}
                  />
                </div>
              ))}
            </div>
          </div>
          )})}

        {layer.facilities && layer.facilities.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Facilities</div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 items-start">
              {layer.facilities.map((f, fi) => (
                <div key={fi} className={`rounded border overflow-hidden transition-colors ${
                  expanded.has(f.name)
                    ? 'border-slate-600/60 bg-slate-800/40 sm:col-span-2 lg:col-span-3'
                    : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-600'
                }`}>
                  <button
                    onClick={() => onToggle(f.name)}
                    className="w-full text-left px-2.5 py-1.5 cursor-pointer flex items-center justify-between gap-2"
                  >
                    <span className={`text-[11px] ${expanded.has(f.name) ? 'text-slate-200' : 'text-slate-400 hover:text-slate-300'}`}>
                      {f.name}
                    </span>
                    <span className={`text-slate-500 text-[10px] shrink-0 transition-transform ${expanded.has(f.name) ? 'rotate-180' : ''}`}>&#9662;</span>
                  </button>
                  {expanded.has(f.name) && (
                    <div className="px-2.5 pb-2 space-y-1.5">
                      <p className="text-xs text-slate-400 leading-relaxed">{f.detail}</p>
                      <NodeLinks node={f} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PersonnelNetwork({ personnel, expanded, onToggle }) {
  return (
    <div id="personnel" className="mt-6 pt-4 border-t border-slate-800">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Personnel Network — The Revolving Door
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 items-start">
        {personnel.map((p, i) => (
          <div
            key={i}
            className={`rounded-lg border overflow-hidden transition-colors ${
              expanded.has(p.name)
                ? 'border-slate-600/60 bg-slate-800/40 sm:col-span-2 lg:col-span-3'
                : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <button
              onClick={() => onToggle(p.name)}
              className="w-full text-left p-2.5 cursor-pointer flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {p.name.split(' ').map(w => w[0]).join('')}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{p.role}</div>
                </div>
              </div>
              <span className={`text-slate-500 text-[10px] shrink-0 transition-transform ${expanded.has(p.name) ? 'rotate-180' : ''}`}>&#9662;</span>
            </button>
            {expanded.has(p.name) && <NodeDetail node={p} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProcessFlow({ steps }) {
  return (
    <div id="kill-chain" className="mt-6 pt-4 border-t border-slate-800">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Recovery Process — Kill Chain
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {steps.map((step, i) => (
          <div key={i} className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 h-full">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-xs font-semibold text-slate-300">{step.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function getAllNodeNames(data) {
  const names = []
  for (const layer of data.layers) {
    for (const agency of layer.agencies) {
      for (const node of agency.nodes) names.push(node.name)
    }
    if (layer.facilities) {
      for (const f of layer.facilities) names.push(f.name)
    }
  }
  for (const p of data.personnel) names.push(p.name)
  return names
}

function ChartSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 border border-indigo-500/20 rounded-lg p-4 sm:p-6 space-y-4">
      <div className="h-4 w-40 bg-slate-800/60 rounded animate-pulse" />
      <div className="h-6 w-56 bg-slate-800/40 rounded animate-pulse" />
      <div className="h-3 w-full bg-slate-800/30 rounded animate-pulse" />
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-900 rounded-lg animate-pulse" />)}
      </div>
    </div>
  )
}

export default function LegacyProgramChart() {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => {
    fetch('/data/legacy_program.json')
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (window.matchMedia('(min-width: 1024px)').matches) {
          setExpanded(new Set(getAllNodeNames(d)))
        }
      })
      .catch(err => console.error('Failed to load legacy program data:', err))
  }, [])

  if (!data) return <ChartSkeleton />

  function toggle(name) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const allNames = getAllNodeNames(data)
  const allExpanded = allNames.every(n => expanded.has(n))

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(allNames))
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 border border-indigo-500/20 rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-indigo-400">{data.subtitle}</div>
          <button onClick={toggleAll} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">{data.title}</h2>
        <p className="text-xs text-slate-500 mb-1">{data.attribution} — click any element for details</p>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">{data.description}</p>

        <div className="space-y-6">
          {data.layers.map((layer, i) => (
            <LayerSection
              key={i}
              layer={layer}
              index={i}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}
        </div>

        <PersonnelNetwork
          personnel={data.personnel}
          expanded={expanded}
          onToggle={toggle}
        />

        <ProcessFlow steps={data.process} />

        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">{data.classification_shield.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{data.classification_shield.detail}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] text-slate-600">Sources:</span>
          {data.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-400/60 hover:text-indigo-400 underline underline-offset-2">
              {s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
