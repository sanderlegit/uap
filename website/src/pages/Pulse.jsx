import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
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

function PulseStats({ stats }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
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
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Sources</div>
      </div>
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-blue-400 tabular-nums">{stats.unanalyzed_items}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pending</div>
      </div>
    </div>
  )
}

function TrendingTopics({ topics }) {
  if (!topics || topics.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-slate-400 mb-3">Trending Topics</h2>
      <div className="flex flex-wrap gap-1.5">
        {topics.slice(0, 20).map((t, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">
            {t.topic} <span className="text-slate-500 ml-1">{t.count}</span>
          </span>
        ))}
      </div>
    </section>
  )
}

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

function FeedItem({ item }) {
  const [expanded, setExpanded] = useState(false)
  const meta = PLATFORM_META[item.platform] || { label: item.platform, color: 'text-slate-400', border: 'border-l-slate-500', bg: 'bg-slate-500/10' }

  return (
    <div
      className={`bg-slate-900 border border-slate-700/50 rounded-lg p-4 border-l-2 ${meta.border} hover:border-slate-600/80 transition-all cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            <span>Credibility: <span className={credColor(item.credibility)}>{(item.credibility * 100).toFixed(0)}%</span></span>
            <span>Novelty: <span className="text-slate-300">{(item.novelty * 100).toFixed(0)}%</span></span>
            <span>Relevance: <span className="text-slate-300">{(item.relevance * 100).toFixed(0)}%</span></span>
          </div>

          {/* Entities */}
          {item.entities && item.entities.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Entities</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.entities.map((e, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/40">
                    {e.name} <span className="text-slate-500">({e.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Theories */}
          {item.theories && item.theories.length > 0 && (
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
          {item.topics && item.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.topics.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{t}</span>
              ))}
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

export default function Pulse() {
  const pulse = usePulse()
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showAnalyzedOnly, setShowAnalyzedOnly] = useState(false)

  const filteredItems = useMemo(() => {
    if (!pulse) return []
    let items = pulse.items || []
    if (platformFilter !== 'all') items = items.filter(i => i.platform === platformFilter)
    if (showAnalyzedOnly) items = items.filter(i => i.analyzed)
    return items
  }, [pulse, platformFilter, showAnalyzedOnly])

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

            {/* Social Awareness Gauge */}
            <section className="mb-10">
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-emerald-400 inline-flex items-center">Social Awareness Index<InfoTooltip text="A composite tracking public, political, scientific, and media engagement with UAP disclosure. Based on congressional activity, media coverage, scientific publications, polling data, and international developments." /></span>
                </div>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-4xl font-extrabold text-white tabular-nums">{AWARENESS_DATA.score}</span>
                  <span className="text-sm text-slate-400">/100</span>
                  <span className="text-xs text-emerald-400 ml-auto">&#9650; {AWARENESS_DATA.trend}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  Composite measure of public, political, scientific, and media engagement with UAP disclosure.
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-5">
                  Scores are editorial estimates based on congressional records, polling, academic publication counts,
                  and media analysis.
                </p>
                <div className="space-y-3">
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
              </div>
            </section>

            <TrendingTopics topics={pulse.trending_topics} />

            {/* Feed */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-200">Live Feed</h2>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={showAnalyzedOnly} onChange={e => setShowAnalyzedOnly(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 w-3 h-3" />
                  Analyzed only
                </label>
              </div>

              <PlatformFilter platforms={pulse.stats?.platforms} active={platformFilter} setActive={setPlatformFilter} />

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
          </>
        )}
      </div>
    </div>
  )
}
