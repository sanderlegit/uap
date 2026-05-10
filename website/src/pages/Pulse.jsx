import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePulse, formatDate } from '../hooks/useData'
import InfoTooltip from '../components/InfoTooltip'

const AWARENESS_DATA = {
  score: 67,
  trend: 'rising',
  indicators: [
    { label: 'Congressional Activity', value: 82, detail: 'Bipartisan hearings, UAPDA legislation, whistleblower protections active' },
    { label: 'Media Coverage', value: 71, detail: 'Mainstream outlets (NYT, CNN, NBC) covering UAP as legitimate news' },
    { label: 'Scientific Engagement', value: 58, detail: 'Harvard (Galileo), Stanford (Sol Foundation), SCU peer-reviewed papers' },
    { label: 'Public Interest', value: 74, detail: 'Polling shows 40%+ believe government knows more than disclosed' },
    { label: 'International Momentum', value: 53, detail: 'Japan forming program, Five Eyes cooperating, South America active' },
    { label: 'Stigma Reduction', value: 65, detail: 'Pilots reporting without career fear; academic credibility increasing' },
  ],
}

const PLATFORM_META = {
  rss: { label: 'News', color: 'text-blue-400', border: 'border-l-blue-500', bg: 'bg-blue-500/10' },
  google_news: { label: 'Google News', color: 'text-emerald-400', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10' },
  gdelt: { label: 'GDELT', color: 'text-amber-400', border: 'border-l-amber-500', bg: 'bg-amber-500/10' },
  reddit: { label: 'Reddit', color: 'text-orange-400', border: 'border-l-orange-500', bg: 'bg-orange-500/10' },
  bluesky: { label: 'Bluesky', color: 'text-sky-400', border: 'border-l-sky-500', bg: 'bg-sky-500/10' },
  scholar: { label: 'Scholar', color: 'text-purple-400', border: 'border-l-purple-500', bg: 'bg-purple-500/10' },
}

const TIER_META = {
  official: { label: 'Official', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  major_outlet: { label: 'Major', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  specialist: { label: 'Specialist', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  academic: { label: 'Academic', color: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  community: { label: 'Community', color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  aggregator: { label: 'Aggregator', color: 'text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
}

const TABS = [
  { key: 'feed', label: 'Feed' },
  { key: 'trends', label: 'Trends' },
  { key: 'entities', label: 'Entities' },
  { key: 'sources', label: 'Sources' },
]

const CONTENT_QUALITY_DOT = {
  full_text: 'bg-emerald-400',
  summary: 'bg-amber-400',
  title_only: 'bg-red-400',
  unknown: 'bg-slate-600',
}

function barColor(v) {
  if (v < 40) return 'bg-red-500'
  if (v <= 65) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function credColor(score) {
  if (score >= 0.7) return 'text-emerald-400'
  if (score >= 0.4) return 'text-amber-400'
  return 'text-red-400'
}

/* ---------- Sparkline SVG ---------- */

function Sparkline({ data, width = 80, height = 20, color = '#6366f1' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block align-middle ml-2 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------- Area Chart SVG ---------- */

function AreaChart({ data, width = 700, height = 160 }) {
  if (!data || data.length === 0) return (
    <div className="text-center py-8 text-slate-500 text-xs">No daily volume data available</div>
  )

  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const padX = 40
  const padY = 20
  const chartW = width - padX - 10
  const chartH = height - padY - 10

  const toX = (i) => padX + (i / Math.max(data.length - 1, 1)) * chartW
  const toY = (v) => padY + chartH - (v / maxTotal) * chartH

  // Total area path
  const totalPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.total)}`).join(' ')
  const totalArea = `${totalPath} L${toX(data.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`

  // Analyzed area path
  const analyzedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.analyzed)}`).join(' ')
  const analyzedArea = `${analyzedPath} L${toX(data.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`

  // Y-axis ticks
  const yTicks = [0, Math.round(maxTotal / 2), maxTotal]

  // X-axis labels (show ~5 date labels)
  const step = Math.max(1, Math.floor(data.length / 5))
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Y gridlines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={padX} y1={toY(v)} x2={width - 10} y2={toY(v)} stroke="#334155" strokeWidth="0.5" />
          <text x={padX - 4} y={toY(v) + 3} textAnchor="end" className="fill-slate-500" fontSize="9">{v}</text>
        </g>
      ))}
      {/* Total area */}
      <path d={totalArea} fill="#3b82f6" opacity="0.15" />
      <path d={totalPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Analyzed area */}
      <path d={analyzedArea} fill="#22c55e" opacity="0.2" />
      <path d={analyzedPath} fill="none" stroke="#22c55e" strokeWidth="1.5" />
      {/* X labels */}
      {xLabels.map((d) => {
        const idx = data.indexOf(d)
        const label = d.date?.slice(5) || ''
        return (
          <text key={idx} x={toX(idx)} y={height - 2} textAnchor="middle" className="fill-slate-500" fontSize="8">{label}</text>
        )
      })}
      {/* Legend */}
      <circle cx={padX + 4} cy={8} r={3} fill="#3b82f6" />
      <text x={padX + 12} y={11} className="fill-slate-400" fontSize="8">Total</text>
      <circle cx={padX + 50} cy={8} r={3} fill="#22c55e" />
      <text x={padX + 58} y={11} className="fill-slate-400" fontSize="8">Analyzed</text>
    </svg>
  )
}

/* ---------- KPI Stats ---------- */

function PulseStats({ stats }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-white tabular-nums">{stats.total_items}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Items Collected</div>
      </div>
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.analyzed_items}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Analyzed</div>
      </div>
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-amber-400 tabular-nums">{Object.keys(stats.platforms || {}).length}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Platforms</div>
      </div>
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-blue-400 tabular-nums">{stats.unanalyzed_items}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pending</div>
      </div>
    </div>
  )
}

/* ---------- Awareness Index (compact) ---------- */

function AwarenessIndex() {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="mb-6">
      <div
        className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 sm:p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-emerald-400 inline-flex items-center">
            Social Awareness Index
            <InfoTooltip text="A composite tracking public, political, scientific, and media engagement with UAP disclosure. Based on congressional activity, media coverage, scientific publications, polling data, and international developments." />
          </span>
          <span className="ml-auto text-[10px] text-slate-500">{expanded ? 'collapse' : 'expand'}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-extrabold text-white tabular-nums">{AWARENESS_DATA.score}</span>
          <span className="text-sm text-slate-400">/100</span>
          <span className="text-xs text-emerald-400 ml-auto">&#9650; {AWARENESS_DATA.trend}</span>
        </div>
        {!expanded && (
          <p className="text-xs text-slate-500 mt-1">
            Composite measure of public, political, scientific, and media engagement.
          </p>
        )}
        {expanded && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Composite measure of public, political, scientific, and media engagement with UAP disclosure.
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
              Scores are editorial estimates based on congressional records, polling, academic publication counts,
              and media analysis.
            </p>
            {AWARENESS_DATA.indicators.map((ind, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300">{ind.label}</span>
                  <span className="text-xs tabular-nums font-medium" style={{ color: ind.value >= 65 ? '#22c55e' : ind.value >= 40 ? '#f59e0b' : '#ef4444' }}>{ind.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-1" role="progressbar" aria-valuenow={ind.value} aria-valuemin={0} aria-valuemax={100} aria-label={`${ind.label}: ${ind.value}%`}>
                  <div className={`h-full rounded-full ${barColor(ind.value)} transition-all duration-1000`} style={{ width: `${ind.value}%` }} />
                </div>
                <p className="text-[10px] text-slate-500">{ind.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------- Tab Navigation ---------- */

function TabNav({ active, setActive }) {
  return (
    <div className="flex gap-0.5 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActive(tab.key)}
          className={`text-xs font-medium px-4 py-2 rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
            active === tab.key
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Platform Filter ---------- */

function PlatformFilter({ platforms, active, setActive }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      <button
        onClick={() => setActive('all')}
        className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
          active === 'all' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-700/50 text-slate-400 hover:text-slate-200'
        }`}
      >All</button>
      {Object.entries(platforms || {}).map(([key, count]) => {
        const meta = PLATFORM_META[key] || { label: key, color: 'text-slate-400' }
        return (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              active === key ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-700/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            {meta.label} <span className="text-slate-500">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Feed Item ---------- */

function FeedItem({ item }) {
  const [expanded, setExpanded] = useState(false)
  const meta = PLATFORM_META[item.platform] || { label: item.platform, color: 'text-slate-400', border: 'border-l-slate-500', bg: 'bg-slate-500/10' }
  const qualityDot = CONTENT_QUALITY_DOT[item.content_quality] || CONTENT_QUALITY_DOT.unknown

  return (
    <div
      className={`bg-slate-900 border border-slate-700/50 rounded-lg p-4 border-l-2 ${meta.border} hover:border-slate-600/80 transition-all cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`w-1.5 h-1.5 rounded-full ${qualityDot} shrink-0`} title={`Content: ${item.content_quality || 'unknown'}`} />
        <time className="text-[10px] text-slate-500 font-mono tabular-nums">{formatDate(item.published_at)}</time>
        <span className={`text-[11px] font-medium ${meta.color} ${meta.bg} border border-current/20 rounded px-2 py-0.5`}>
          {meta.label}
        </span>
        {item.author && (
          <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.author}</span>
        )}
        {item.analyzed && item.relevance != null && (
          <span className={`text-[10px] ml-auto tabular-nums ${item.relevance >= 0.7 ? 'text-emerald-400' : item.relevance >= 0.3 ? 'text-slate-400' : 'text-slate-600'}`}>
            rel {(item.relevance * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-slate-200 mb-1.5 leading-snug">{item.title}</h3>

      {item.analyzed && item.summary && (
        <p className="text-xs text-slate-400 leading-relaxed mb-2">{item.summary}</p>
      )}

      {expanded && item.analyzed && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
          {/* Scores */}
          <div className="flex gap-4 text-[10px]">
            {item.credibility != null && <span>Credibility: <span className={credColor(item.credibility)}>{(item.credibility * 100).toFixed(0)}%</span></span>}
            {item.novelty != null && <span>Novelty: <span className="text-slate-300">{(item.novelty * 100).toFixed(0)}%</span></span>}
            {item.relevance != null && <span>Relevance: <span className="text-slate-300">{(item.relevance * 100).toFixed(0)}%</span></span>}
          </div>

          {/* Entities */}
          {item.entities?.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Entities</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.entities.map((e, i) => (
                  <Link key={i} to={`/entities?q=${encodeURIComponent(e.name)}`}
                    onClick={ev => ev.stopPropagation()}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/40 hover:bg-slate-700/50 hover:text-slate-200 transition-colors">
                    {e.name} <span className="text-slate-500">({e.type})</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Theories */}
          {item.theories?.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Theories</span>
              {item.theories.map((t, i) => (
                <div key={i} className="mt-1 text-xs text-slate-400">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1.5 ${
                    t.evidence_strength === 'strong' ? 'bg-emerald-500/20 text-emerald-400' :
                    t.evidence_strength === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>{t.evidence_strength}</span>
                  {t.theory}
                </div>
              ))}
            </div>
          )}

          {/* Topics */}
          {item.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.topics.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{t}</span>
              ))}
            </div>
          )}

          {/* Corpus Connections */}
          {item.corpus_connections?.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Corpus Connections</span>
              <div className="mt-1 space-y-1">
                {item.corpus_connections.map((conn, i) => {
                  // corpus_connections can be strings (topic matches) or objects with doc info
                  if (typeof conn === 'string') {
                    return (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-block mr-1 mb-1">
                        {conn}
                      </span>
                    )
                  }
                  // Object form: { doc_id, doc_code, matched_terms, score }
                  return (
                    <div key={i} className="text-xs text-slate-400">
                      <Link
                        to={`/documents/${conn.doc_id}`}
                        className="text-cyan-400 hover:text-cyan-300"
                        onClick={e => e.stopPropagation()}
                      >
                        Document #{conn.doc_id}: {conn.doc_code || ''}
                      </Link>
                      {conn.matched_terms && (
                        <span className="text-slate-500 ml-1">(matched: {Array.isArray(conn.matched_terms) ? conn.matched_terms.join(', ') : conn.matched_terms})</span>
                      )}
                      {conn.score != null && (
                        <span className="text-slate-500 ml-1">-- {(conn.score * 100).toFixed(0)}% match</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Link */}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              onClick={e => e.stopPropagation()}>
              Open source &rarr;
            </a>
          )}
        </div>
      )}

      {!item.analyzed && (
        <p className="text-[10px] text-slate-600 italic mt-1">Pending analysis</p>
      )}
    </div>
  )
}

/* ---------- Tab: Feed ---------- */

function FeedTab({ pulse, platformFilter, setPlatformFilter }) {
  const [showAnalyzedOnly, setShowAnalyzedOnly] = useState(false)

  const filteredItems = useMemo(() => {
    if (!pulse) return []
    let items = pulse.items || []
    if (platformFilter !== 'all') items = items.filter(i => i.platform === platformFilter)
    if (showAnalyzedOnly) items = items.filter(i => i.analyzed)
    items = [...items].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
    return items
  }, [pulse, platformFilter, showAnalyzedOnly])

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Feed</h2>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />full text</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />summary</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />title only</span>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showAnalyzedOnly} onChange={e => setShowAnalyzedOnly(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-blue-500 w-3 h-3" />
            Analyzed only
          </label>
        </div>
      </div>

      <PlatformFilter platforms={pulse?.stats?.platforms} active={platformFilter} setActive={setPlatformFilter} />

      <div className="space-y-2">
        {filteredItems.slice(0, 100).map(item => (
          <FeedItem key={`${item.platform}-${item.id}`} item={item} />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">No items match filters</div>
      )}

      {filteredItems.length > 100 && (
        <p className="text-center text-xs text-slate-500 mt-4">
          Showing 100 of {filteredItems.length} items
        </p>
      )}
    </section>
  )
}

/* ---------- Tab: Trends ---------- */

function TrendsTab({ pulse }) {
  const dailyVolume = pulse?.daily_volume || []
  const topics = pulse?.trending_topics || []

  return (
    <section className="space-y-8">
      {/* Daily Volume Chart */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Daily Volume (90 days)</h2>
        <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-4">
          <AreaChart data={dailyVolume} />
        </div>
      </div>

      {/* Trending Topics with Sparklines */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Trending Topics</h2>
        {topics.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No trending topics</div>
        ) : (
          <div className="space-y-1">
            {topics.slice(0, 25).map((t, i) => (
              <Link key={i} to={`/search?q=${encodeURIComponent(t.topic)}`}
                className="flex items-center gap-3 bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2 hover:bg-slate-800/50 transition-colors">
                <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{t.topic}</span>
                <Sparkline data={t.sparkline} width={72} height={18} color="#818cf8" />
                <span className="text-[10px] text-slate-500 tabular-nums w-6 text-right shrink-0">{t.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------- Tab: Entities ---------- */

function EntitiesTab({ pulse }) {
  const entityBridge = pulse?.entity_bridge || []
  const entityIndex = pulse?.entity_index || []

  // If entity_bridge exists and has data, show bridge cards
  // Otherwise fall back to entity_index
  const entities = entityBridge.length > 0 ? entityBridge : entityIndex

  const TYPE_COLORS = {
    person: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    organization: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    location: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    program: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    event: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    technology: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    unknown: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  }

  if (entities.length === 0) {
    return <div className="text-center py-12 text-slate-500 text-sm">No entity data available</div>
  }

  const isBridge = entityBridge.length > 0

  return (
    <section>
      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
        {isBridge ? 'Entity Bridge (Pulse + Corpus)' : 'Entity Index'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entities.slice(0, 50).map((ent, i) => {
          const typeClass = TYPE_COLORS[ent.type] || TYPE_COLORS.unknown
          return (
            <div key={i} className="bg-slate-900 border border-slate-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Link to={`/entities?q=${encodeURIComponent(ent.name)}`} className="text-sm font-semibold text-slate-200 truncate hover:text-blue-300 transition-colors">{ent.name}</Link>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${typeClass} shrink-0`}>
                  {ent.type}
                </span>
              </div>
              {isBridge ? (
                <div className="flex gap-4 text-[10px] text-slate-500">
                  <span>Pulse: <span className="text-slate-300">{ent.pulse_mentions || 0}</span></span>
                  <span>Corpus: <span className="text-slate-300">{(ent.corpus_doc_ids || []).length}</span> docs</span>
                  {(ent.corpus_doc_ids || []).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {ent.corpus_doc_ids.slice(0, 5).map(docId => (
                        <Link key={docId} to={`/documents/${docId}`} className="text-blue-400 hover:text-blue-300" onClick={e => e.stopPropagation()}>
                          #{docId}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-4 text-[10px] text-slate-500">
                  <span>Mentions: <span className="text-slate-300">{ent.mentions}</span></span>
                  {ent.contexts?.length > 0 && (
                    <span className="truncate text-slate-600" title={ent.contexts[0]}>{ent.contexts[0]}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {entities.length > 50 && (
        <p className="text-center text-xs text-slate-500 mt-4">Showing 50 of {entities.length} entities</p>
      )}
    </section>
  )
}

/* ---------- Tab: Sources ---------- */

function SourcesTab({ pulse }) {
  const sourceStats = pulse?.source_stats || []

  if (sourceStats.length === 0) {
    return <div className="text-center py-12 text-slate-500 text-sm">No source statistics available</div>
  }

  const maxItems = Math.max(...sourceStats.map(s => s.item_count), 1)

  // Find errors from recent_runs in stats
  const recentRuns = pulse?.stats?.recent_runs || []
  const sourceErrors = {}
  for (const run of recentRuns) {
    if (run.error && run.source_name) {
      sourceErrors[run.source_name] = run.error
    }
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Source Statistics</h2>

      {/* Tier legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(TIER_META).map(([key, meta]) => (
          <span key={key} className={`text-[10px] px-2 py-0.5 rounded border ${meta.bg} ${meta.color} ${meta.border}`}>
            {meta.label}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {sourceStats.map((src, i) => {
          const tier = TIER_META[src.tier] || TIER_META.aggregator
          const pctAnalyzed = src.item_count > 0 ? Math.round((src.analyzed_count / src.item_count) * 100) : 0
          const barWidth = Math.round((src.item_count / maxItems) * 100)
          const error = sourceErrors[src.name]

          return (
            <div key={i} className="bg-slate-900 border border-slate-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200 truncate flex-1 min-w-0">{src.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${tier.bg} ${tier.color} ${tier.border}`}>
                  {tier.label}
                </span>
                {(PLATFORM_META[src.platform] || {}).label && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${(PLATFORM_META[src.platform] || {}).bg || ''} ${(PLATFORM_META[src.platform] || {}).color || 'text-slate-400'} shrink-0`}>
                    {(PLATFORM_META[src.platform] || {}).label || src.platform}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex gap-4 text-[10px] text-slate-500 mb-2">
                <span>Items: <span className="text-slate-300 tabular-nums">{src.item_count}</span></span>
                <span>Analyzed: <span className={pctAnalyzed > 50 ? 'text-emerald-400' : pctAnalyzed > 0 ? 'text-amber-400' : 'text-slate-500'}>{pctAnalyzed}%</span></span>
                {src.avg_credibility != null && (
                  <span>Credibility: <span className={credColor(src.avg_credibility)}>{(src.avg_credibility * 100).toFixed(0)}%</span></span>
                )}
              </div>

              {/* Bar */}
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/60 transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-[10px] text-red-400/80 mt-1.5 truncate" title={error}>
                  Error: {error}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- Main Page ---------- */

export default function Pulse() {
  const pulse = usePulse()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'feed'
  const platformFilter = searchParams.get('platform') || 'all'

  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab && tab !== 'feed') next.set('tab', tab)
    else next.delete('tab')
    next.delete('platform')
    setSearchParams(next, { replace: true })
  }

  const setPlatformFilter = (platform) => {
    const next = new URLSearchParams(searchParams)
    if (platform && platform !== 'all') next.set('platform', platform)
    else next.delete('platform')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 sm:pt-12">
        <h1 className="text-xl font-bold text-slate-100 mb-2">UAP Pulse</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">
          Live feed from news, social media, and academic sources — automatically collected and analyzed.
        </p>
        {pulse?.generated_at && (
          <p className="text-[10px] text-slate-600 mb-6">
            Last updated: {formatDate(pulse.generated_at)}
          </p>
        )}

        {!pulse && (
          <div className="text-center py-20 text-slate-500 text-sm">Loading pulse data...</div>
        )}

        {pulse && (
          <>
            <PulseStats stats={pulse.stats} />
            <AwarenessIndex />
            <TabNav active={activeTab} setActive={setActiveTab} />

            {activeTab === 'feed' && (
              <FeedTab pulse={pulse} platformFilter={platformFilter} setPlatformFilter={setPlatformFilter} />
            )}
            {activeTab === 'trends' && <TrendsTab pulse={pulse} />}
            {activeTab === 'entities' && <EntitiesTab pulse={pulse} />}
            {activeTab === 'sources' && <SourcesTab pulse={pulse} />}
          </>
        )}
      </div>
    </div>
  )
}
