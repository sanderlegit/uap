import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STATUS_COLORS = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Active' },
  closed: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Closed' },
  disclosure: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Disclosure' },
  forming: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Forming' },
  legislative: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Legislative' },
  none: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'No Program' },
}

function CountryCard({ country, isExpanded, onToggle }) {
  const status = STATUS_COLORS[country.status] || STATUS_COLORS.none

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{country.code === 'FR' ? '🇫🇷' : country.code === 'GB' ? '🇬🇧' : country.code === 'BR' ? '🇧🇷' : country.code === 'CL' ? '🇨🇱' : country.code === 'UY' ? '🇺🇾' : country.code === 'AR' ? '🇦🇷' : country.code === 'PE' ? '🇵🇪' : country.code === 'JP' ? '🇯🇵' : country.code === 'CA' ? '🇨🇦' : country.code === 'AU' ? '🇦🇺' : country.code === 'BE' ? '🇧🇪' : country.code === 'MX' ? '🇲🇽' : country.code === 'IN' ? '🇮🇳' : country.code === 'IL' ? '🇮🇱' : '🌐'}</span>
            <h3 className="text-sm font-semibold text-slate-200">{country.country}</h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{country.stance}</p>
        {country.programs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {country.programs.map((p, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/30">
                {p.name} ({p.years})
              </span>
            ))}
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          {country.programs.map((p, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="text-xs font-semibold text-slate-200">{p.name}</h4>
                {p.status && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                    {p.status}
                  </span>
                )}
              </div>
              {p.full_name && <p className="text-[10px] text-indigo-400/70 mb-1">{p.full_name}</p>}
              <p className="text-[10px] text-slate-500 mb-1">{p.agency} · {p.years}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
              {p.stats && (
                <div className="flex gap-4 mt-2">
                  {p.stats.total_testimonies && (
                    <div>
                      <div className="text-sm font-bold text-indigo-400 tabular-nums">{p.stats.total_testimonies.toLocaleString()}</div>
                      <div className="text-[9px] text-slate-500">Testimonies</div>
                    </div>
                  )}
                  {p.stats.cases_analyzed && (
                    <div>
                      <div className="text-sm font-bold text-indigo-400 tabular-nums">{p.stats.cases_analyzed.toLocaleString()}</div>
                      <div className="text-[9px] text-slate-500">Cases</div>
                    </div>
                  )}
                  {p.stats.unexplained_pct != null && (
                    <div>
                      <div className="text-sm font-bold text-amber-400 tabular-nums">{p.stats.unexplained_pct}%</div>
                      <div className="text-[9px] text-slate-500">Unexplained</div>
                    </div>
                  )}
                  {p.stats.pages_declassified && (
                    <div>
                      <div className="text-sm font-bold text-indigo-400 tabular-nums">{p.stats.pages_declassified.toLocaleString()}</div>
                      <div className="text-[9px] text-slate-500">Pages Released</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {country.notable_case && (
            <div>
              <h4 className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider mb-1">Notable Case</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{country.notable_case}</p>
            </div>
          )}

          {country.sources && country.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {country.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
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

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-10 space-y-4">
        <div className="h-6 w-48 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-800/40 rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function International() {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetch('/data/international.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load international data:', err))
  }, [])

  if (!data) return <Skeleton />

  const countries = statusFilter === 'all'
    ? data.countries
    : data.countries.filter(c => c.status === statusFilter)

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 sm:pt-12">
        <h1 className="text-xl font-bold text-slate-100 mb-2">International UAP Programs</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">{data.overview}</p>
        <p className="text-xs text-slate-600 mb-6">
          {data.countries.length} countries &middot; Last updated {data.last_updated} &middot;{' '}
          <Link to="/" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Dashboard</Link>
        </p>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{data.summary.active_programs}</div>
            <div className="text-[10px] text-slate-500">Active Programs</div>
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-400 tabular-nums">{data.summary.closed_programs}</div>
            <div className="text-[10px] text-slate-500">Closed Programs</div>
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-400 tabular-nums">{data.summary.countries_researched}</div>
            <div className="text-[10px] text-slate-500">Countries</div>
          </div>
        </div>

        {/* Five Eyes */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/20 border border-blue-500/20 rounded-lg p-4 mb-8">
          <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">{data.five_eyes.name}</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">{data.five_eyes.description}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {data.five_eyes.members.map((m, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {m}
              </span>
            ))}
          </div>
          <div className="space-y-1.5">
            {data.five_eyes.key_events.map((ev, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-blue-400 font-bold tabular-nums shrink-0 w-16">{ev.date}</span>
                <span className="text-[10px] text-slate-400">{ev.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {['all', 'active', 'forming', 'disclosure', 'closed', 'none'].map(s => {
            const count = s === 'all' ? data.countries.length : data.countries.filter(c => c.status === s).length
            if (count === 0 && s !== 'all') return null
            const st = STATUS_COLORS[s] || {}
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors ${
                  statusFilter === s
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {s === 'all' ? `All (${count})` : `${st.label || s} (${count})`}
              </button>
            )
          })}
        </div>

        {/* Country cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {countries.map(c => (
            <CountryCard
              key={c.id}
              country={c}
              isExpanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
