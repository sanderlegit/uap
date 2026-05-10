import { useMemo, useState } from 'react'

const LAYER_COLORS = {
  surveillance: '#3b82f6',
  custodial: '#f59e0b',
  industrial: '#ef4444',
}

const LAYER_LABELS = {
  surveillance: 'Surveillance',
  custodial: 'Custodial',
  industrial: 'Industrial',
}

export default function LegacyTree({
  data,
  selectedOrgs,
  onToggleOrg,
  onSelectLayer,
  selectedLayer,
  highlightedOrgs,
  onClear,
}) {
  const [collapsed, setCollapsed] = useState({})

  const orgNodes = useMemo(
    () => data.nodes.filter((n) => n.type === 'org'),
    [data]
  )

  const docCountByOrg = useMemo(() => {
    const counts = {}
    data.edges
      .filter((e) => e.type === 'document')
      .forEach((e) => {
        counts[e.target] = (counts[e.target] || 0) + 1
      })
    return counts
  }, [data])

  const orgsByLayer = useMemo(() => {
    const grouped = {}
    for (const layer of Object.keys(LAYER_LABELS)) {
      grouped[layer] = orgNodes
        .filter((n) => n.layer === layer)
        .sort((a, b) => (docCountByOrg[b.id] || 0) - (docCountByOrg[a.id] || 0))
    }
    return grouped
  }, [orgNodes, docCountByOrg])

  const congressionalNode = useMemo(
    () => orgNodes.find((n) => n.id === 'congressional'),
    [orgNodes]
  )

  const hasFilters = selectedOrgs.size > 0 || selectedLayer

  const toggleCollapse = (layer) => {
    setCollapsed((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-300 text-sm">
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <h2 className="text-amber-400 font-bold text-base tracking-wide uppercase">
          The Legacy Program
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          {data.metadata.total_documents} documents
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {Object.entries(LAYER_LABELS).map(([layerId, label]) => {
          const color = LAYER_COLORS[layerId]
          const isLayerSelected = selectedLayer === layerId
          const isCollapsed = collapsed[layerId]

          return (
            <div key={layerId}>
              <button
                onClick={() => toggleCollapse(layerId)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-slate-800/60 transition-colors group"
              >
                <span
                  className="text-xs w-4 text-center transition-transform"
                  style={{ color }}
                >
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span
                  className="font-semibold text-sm tracking-wide cursor-pointer"
                  style={{ color }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectLayer(isLayerSelected ? null : layerId)
                  }}
                >
                  {label}
                </span>
                {isLayerSelected && (
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: color + '20',
                      color,
                    }}
                  >
                    filtered
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <div className="ml-3 border-l border-slate-800 pl-1 space-y-px">
                  {orgsByLayer[layerId].map((org) => (
                    <OrgItem
                      key={org.id}
                      org={org}
                      count={docCountByOrg[org.id] || 0}
                      color={color}
                      isSelected={selectedOrgs.has(org.id)}
                      isHighlighted={highlightedOrgs?.has(org.id)}
                      onToggle={() => onToggleOrg(org.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {congressionalNode && (
          <div className="mt-1 pt-1 border-t border-slate-800">
            <OrgItem
              org={congressionalNode}
              count={docCountByOrg[congressionalNode.id] || 0}
              color="#10b981"
              isSelected={selectedOrgs.has(congressionalNode.id)}
              isHighlighted={highlightedOrgs?.has(congressionalNode.id)}
              onToggle={() => onToggleOrg(congressionalNode.id)}
              indent={false}
            />
          </div>
        )}
      </div>

      {hasFilters && (
        <div className="px-4 py-3 border-t border-slate-800">
          <button
            onClick={onClear}
            className="w-full text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded px-3 py-1.5 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function OrgItem({ org, count, color, isSelected, isHighlighted, onToggle, indent = true }) {
  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors
        ${indent ? 'ml-1' : 'px-3'}
        ${isSelected ? 'bg-opacity-10' : 'hover:bg-slate-800/50'}
      `}
      style={isSelected ? { backgroundColor: color + '15' } : undefined}
      title={org.description}
    >
      <span className="relative flex-shrink-0 w-3 h-3 flex items-center justify-center">
        {isHighlighted && (
          <span
            className="absolute inset-[-3px] rounded-full animate-pulse opacity-40"
            style={{ boxShadow: `0 0 6px 2px ${color}` }}
          />
        )}
        <span
          className="w-2 h-2 rounded-full border"
          style={{
            borderColor: color,
            backgroundColor: isSelected || isHighlighted ? color : 'transparent',
          }}
        />
      </span>
      <span
        className="truncate flex-1 text-xs"
        style={{ color: isSelected ? color : undefined }}
      >
        {org.label}
      </span>
      <span className="text-slate-600 text-[11px] tabular-nums flex-shrink-0">
        ({count})
      </span>
    </button>
  )
}
