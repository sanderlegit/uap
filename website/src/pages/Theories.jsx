import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) return
    const start = performance.now()
    let raf
    function tick(now) {
      const p = Math.min((now - start) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function PopularityBar({ label, value, color }) {
  const display = useCountUp(value)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right">{display}%</span>
    </div>
  )
}

function TheoryCard({ theory, isExpanded, onToggle }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span
            className="text-2xl mt-0.5 w-8 text-center shrink-0"
            style={{ color: theory.color }}
          >
            {theory.icon}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-200">{theory.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{theory.short}</p>
            <div className="mt-2.5 space-y-1">
              <PopularityBar label="Popularity" value={theory.popularity} color={theory.color} />
              <PopularityBar label="Sci. support" value={theory.scientific_support} color={theory.color} />
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{theory.description}</p>

          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Key Proponents</h4>
            <div className="flex flex-wrap gap-1.5">
              {theory.key_proponents.map((p, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">{p}</span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Evidence Cited</h4>
            <ul className="space-y-1">
              {theory.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-[10px] mt-0.5 shrink-0" style={{ color: theory.color }}>▸</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1.5">Strengths</h4>
              <ul className="space-y-1">
                {theory.strengths.map((s, i) => (
                  <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5 shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold text-red-400/70 uppercase tracking-wider mb-1.5">Weaknesses</h4>
              <ul className="space-y-1">
                {theory.weaknesses.map((w, i) => (
                  <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5 shrink-0">−</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {theory.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sources</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {theory.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GerbFramework({ framework }) {
  const [layerOpen, setLayerOpen] = useState(null)
  const [timelineOpen, setTimelineOpen] = useState(false)

  const layerColors = ['#3b82f6', '#f59e0b', '#ef4444']

  return (
    <section className="mt-10">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-indigo-500/20 rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Featured Framework</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">{framework.title}</h2>
          <p className="text-xs text-slate-500 mb-3">{framework.attribution}</p>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">{framework.description}</p>

          {/* Three Layers */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Three-Layer Secrecy Architecture</h3>
          <div className="space-y-2 mb-6">
            {framework.three_layers.map((layer, i) => (
              <div key={i} className="border rounded-lg overflow-hidden"
                style={{ borderColor: `${layerColors[i]}30` }}>
                <button
                  onClick={() => setLayerOpen(layerOpen === i ? null : i)}
                  className="w-full text-left p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: `${layerColors[i]}15`, color: layerColors[i] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200">{layer.name}</div>
                      <div className="text-[11px] text-slate-500">{layer.lead_agency}</div>
                    </div>
                    <span className="text-xs text-slate-600">{layerOpen === i ? '▾' : '▸'}</span>
                  </div>
                </button>
                {layerOpen === i && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-800/50">
                    <p className="text-xs text-slate-400 leading-relaxed mt-2">{layer.description}</p>
                    <p className="text-[11px] text-indigo-400/80 mt-2 italic">{layer.key_detail}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Key Personnel */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Personnel (Revolving Door)</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 mb-6">
            {framework.key_personnel.map((p, i) => (
              <div key={i} className="flex items-start gap-2 bg-slate-800/30 rounded px-2.5 py-1.5">
                <span className="text-[10px] text-indigo-400 mt-0.5">●</span>
                <div>
                  <span className="text-xs font-medium text-slate-300">{p.name}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">{p.role}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Facilities */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Facilities</h3>
          <div className="flex flex-wrap gap-1.5 mb-6">
            {framework.key_facilities.map((f, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-slate-800/60 text-slate-400 border border-slate-700/30">
                {f}
              </span>
            ))}
          </div>

          {/* Timeline */}
          <button
            onClick={() => setTimelineOpen(o => !o)}
            className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            Historical Timeline <span className="text-slate-600">{timelineOpen ? '▾' : '▸'}</span>
          </button>
          {timelineOpen && (
            <div className="relative pl-6 mt-2 mb-4">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-indigo-500/30" />
              {framework.historical_timeline.map((ev, i) => (
                <div key={i} className="relative mb-3 last:mb-0">
                  <div className="absolute left-[-17px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-indigo-400 tabular-nums w-10 shrink-0">{ev.year}</span>
                    <span className="text-xs text-slate-300">{ev.event}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documentary Evidence */}
          <details className="mt-4">
            <summary className="text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors">
              Documentary Evidence Cited
            </summary>
            <ul className="mt-2 space-y-1">
              {framework.documentary_evidence.map((d, i) => (
                <li key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                  <span className="text-indigo-500 mt-0.5">◆</span>{d}
                </li>
              ))}
            </ul>
          </details>

          {/* Sources */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sources</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {framework.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ResearcherCard({ r }) {
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      className="block bg-slate-900 border border-slate-700/50 rounded-lg p-3 hover:bg-slate-800/50 transition-colors group">
      <div className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{r.name}</div>
      <div className="text-[11px] text-slate-500 mb-1.5">{r.affiliation}</div>
      <div className="text-[11px] text-indigo-400/70 mb-1">{r.focus}</div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{r.key_finding}</p>
    </a>
  )
}

function CommunitySource({ source }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <a href={source.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-slate-200 hover:text-indigo-300 transition-colors">
            {source.name}
          </a>
          <span className="ml-2 text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">{source.type}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{source.description}</p>
      {source.notable_content && (
        <div>
          <h4 className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Notable Content</h4>
          <ul className="space-y-0.5">
            {source.notable_content.slice(0, 4).map((c, i) => (
              <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <span className="text-indigo-500 mt-0.5">▸</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {source.key_resources && (
        <div>
          <h4 className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Key Resources</h4>
          {source.key_resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              className="block mb-1.5 last:mb-0">
              <span className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">{r.name}</span>
              <span className="text-[10px] text-slate-500 ml-1.5">{r.description}</span>
            </a>
          ))}
        </div>
      )}
      {source.stats_2025 && (
        <div className="mt-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.total_cases?.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Total Cases</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.field_investigators}+</div>
              <div className="text-[10px] text-slate-500">Investigators</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-400 tabular-nums">{source.stats_2025.countries}</div>
              <div className="text-[10px] text-slate-500">Countries</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-10 space-y-4">
        <div className="h-6 w-48 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-800/40 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-slate-800/40 rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Theories() {
  const [data, setData] = useState(null)
  const [expandedTheory, setExpandedTheory] = useState(null)
  const [sortBy, setSortBy] = useState('popularity')

  useEffect(() => {
    fetch('/data/theories.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load theories:', err))
  }, [])

  const sortedTheories = useMemo(() => {
    if (!data) return []
    const t = [...data.theories]
    if (sortBy === 'popularity') t.sort((a, b) => b.popularity - a.popularity)
    else if (sortBy === 'scientific') t.sort((a, b) => b.scientific_support - a.scientific_support)
    else t.sort((a, b) => a.name.localeCompare(b.name))
    return t
  }, [data, sortBy])

  if (!data) return <Skeleton />

  const communitySources = [data.community_sources.uap_gerb, data.community_sources.american_alchemy, data.community_sources.mufon]

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 sm:pt-12">
        {/* Header */}
        <h1 className="text-xl font-bold text-slate-100 mb-2">UAP Origin Theories</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">{data.overview}</p>
        <p className="text-xs text-slate-600 mb-8">
          Last updated {data.last_updated} &middot;{' '}
          <Link to="/" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">
            Back to dashboard
          </Link>
        </p>

        {/* Gerb Framework — Featured */}
        <GerbFramework framework={data.gerb_framework} />

        {/* Theories Grid */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-200">Competing Hypotheses</h2>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="scientific">Sort: Scientific Support</option>
              <option value="name">Sort: A–Z</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedTheories.map(t => (
              <TheoryCard
                key={t.id}
                theory={t}
                isExpanded={expandedTheory === t.id}
                onToggle={() => setExpandedTheory(expandedTheory === t.id ? null : t.id)}
              />
            ))}
          </div>
        </section>

        {/* Key Researchers */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Key Researchers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.key_researchers.map((r, i) => (
              <ResearcherCard key={i} r={r} />
            ))}
          </div>
        </section>

        {/* Community Sources */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-200 mb-2">Community Sources</h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Independent researchers and organizations providing ongoing UAP investigation and analysis.
          </p>
          <div className="grid gap-4">
            {communitySources.map((s, i) => (
              <CommunitySource key={i} source={s} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
