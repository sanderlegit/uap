import { Link } from 'react-router-dom'

const DEMO_NEWS = [
  {
    date: '2026-05-08',
    source: 'war.gov',
    title: 'PURSUE Files Released: 162 Declassified UAP Documents',
    summary: 'The Pentagon releases the largest single disclosure of UAP documents in U.S. history under the Presidential Unsealing and Reporting System for UAP Encounters.',
    type: 'official',
  },
  {
    date: '2026-04-15',
    source: 'The Debrief',
    title: 'AARO Annual Report: 2,000+ Open Cases',
    summary: 'AARO Director Jon Kosloski briefs Congress on the expanding caseload, with particular emphasis on transmedium incidents and near-misses with military aircraft.',
    type: 'journalism',
  },
  {
    date: '2026-03-22',
    source: 'Liberation Times',
    title: 'Five Eyes Expand UAP Data Sharing Protocol',
    summary: 'Leaked documents reveal the Five Eyes alliance has formalized UAP sensor data sharing protocols, including standardized reporting formats for allied militaries.',
    type: 'journalism',
  },
  {
    date: '2026-02-10',
    source: 'The Black Vault',
    title: 'Server Wipe Incident: 3.8M Files Deleted, Restored',
    summary: 'Hours after a disclosure order, The Black Vault\'s servers were wiped of 3.8 million files. John Greenewald restored everything from secure offsite backups within 48 hours.',
    type: 'incident',
  },
  {
    date: '2026-01-28',
    source: 'Sol Foundation',
    title: 'Third Annual Symposium Announced: Stanford, October 2026',
    summary: 'The Sol Foundation announces its third annual academic symposium focusing on the physics of anomalous propulsion and policy implications of disclosure.',
    type: 'academic',
  },
]

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

const TYPE_COLORS = {
  official: 'border-l-amber-500',
  journalism: 'border-l-blue-500',
  incident: 'border-l-red-500',
  academic: 'border-l-purple-500',
}

function barColor(v) {
  if (v < 40) return 'bg-red-500'
  if (v <= 65) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function Pulse() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 sm:pt-12">
        <h1 className="text-xl font-bold text-slate-100 mb-2">UAP Pulse</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">
          News feed and public awareness tracking. Monitoring the social, political, and scientific
          momentum around UAP disclosure.
        </p>
        <p className="text-xs text-slate-600 mb-8">
          <span className="text-amber-500/60 bg-amber-500/5 border border-amber-500/20 rounded px-1.5 py-0.5 text-[10px] font-mono">STUB</span>
          {' '}Demo content — live data integration planned &middot;{' '}
          <Link to="/" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">Dashboard</Link>
        </p>

        {/* Social Awareness Gauge */}
        <section className="mb-10">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-emerald-400">Social Awareness Index</span>
            </div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-4xl font-extrabold text-white tabular-nums">{AWARENESS_DATA.score}</span>
              <span className="text-sm text-slate-400">/100</span>
              <span className="text-xs text-emerald-400 ml-auto">▲ {AWARENESS_DATA.trend}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Composite measure of public, political, scientific, and media engagement with UAP disclosure.
              Higher scores indicate greater mainstream awareness and institutional legitimacy.
            </p>

            <div className="space-y-3">
              {AWARENESS_DATA.indicators.map((ind, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300">{ind.label}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{ind.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${barColor(ind.value)} transition-all duration-1000`}
                      style={{ width: `${ind.value}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">{ind.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* News Feed */}
        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-4">Latest Developments</h2>
          <div className="space-y-3">
            {DEMO_NEWS.map((item, i) => (
              <div
                key={i}
                className={`bg-slate-900 border border-slate-700/50 rounded-lg p-4 border-l-2 ${TYPE_COLORS[item.type] || ''}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-slate-500 font-mono tabular-nums">{item.date}</span>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.5">{item.source}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Future stubs */}
        <section className="mt-10">
          <div className="bg-slate-900/40 border border-dashed border-slate-700/50 rounded-lg p-6 text-center">
            <p className="text-xs text-slate-500 mb-2">Planned integrations</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['RSS/News Aggregation', 'Reddit/X Monitoring', 'Congressional Alert Feed', 'AARO Update Tracker', 'Podcast New Episodes'].map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-800/60 text-slate-500 border border-slate-700/30">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
