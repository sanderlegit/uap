import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import InfoTooltip from '../components/InfoTooltip'

/* ---------- helpers ---------- */

function barColor(score) {
  if (score < 30) return 'bg-red-500'
  if (score <= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function barTrack(score) {
  if (score < 30) return 'bg-red-500/15'
  if (score <= 60) return 'bg-amber-500/15'
  return 'bg-emerald-500/15'
}

/* ---------- animated counter hook ---------- */

function useCountUp(target, duration = 2000) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target == null) return
    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

/* ---------- SVG gauge ---------- */

const GAUGE_SIZE = 220
const STROKE = 14
const RADIUS = (GAUGE_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function Gauge({ score }) {
  const displayNum = useCountUp(score, 2000)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // trigger CSS transition after mount
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const offset = mounted
    ? CIRCUMFERENCE * (1 - (score ?? 0) / 100)
    : CIRCUMFERENCE

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#1e293b"
          strokeWidth={STROKE}
        />
        {/* fill */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.33,1,0.68,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold text-white tabular-nums">
          {displayNum}%
        </span>
        <span className="text-sm text-slate-400 mt-1 tracking-wide inline-flex items-center">Disclosure Index<InfoTooltip text="A weighted composite of 8 dimensions measuring how much the U.S. government has officially revealed about UAP. 100% would mean full, transparent disclosure across all dimensions." /></span>
      </div>
    </div>
  )
}

/* ---------- dimension card ---------- */

function DimensionCard({ dim }) {
  const [open, setOpen] = useState(false)
  const achieved = dim.milestones.filter(m => m.achieved).length
  const total = dim.milestones.length

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600/80 hover:translate-y-[-1px] hover:shadow-lg transition-all">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-slate-200 leading-snug">{dim.name}</h3>
          <span className="text-lg font-bold tabular-nums flex-shrink-0" style={{ color: dim.score >= 60 ? '#22c55e' : dim.score >= 30 ? '#f59e0b' : '#ef4444' }}>
            {dim.score}
          </span>
        </div>

        <div
          className={`h-2 rounded-full ${barTrack(dim.score)} overflow-hidden`}
          role="progressbar"
          aria-valuenow={dim.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${dim.name}: ${dim.score}%`}
        >
          <div
            className={`h-full rounded-full ${barColor(dim.score)} transition-all duration-1000`}
            style={{ width: `${dim.score}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-500">
            {achieved}/{total} milestones achieved
          </span>
          <span className="text-[11px] text-slate-500 inline-flex items-center">
            Weight: {(dim.weight * 100).toFixed(0)}%
            <InfoTooltip text="How much this dimension contributes to the overall Disclosure Index score. Higher weight means this dimension has more influence on the composite number." />
          </span>
        </div>
      </button>

      {/* expanded milestone list */}
      {open && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">{dim.description}</p>
          {dim.milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {m.achieved ? (
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                  &#10003;
                </span>
              ) : (
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border border-slate-600" />
              )}
              <div className="min-w-0">
                <span className={`text-xs leading-snug ${m.achieved ? 'text-slate-200' : 'text-slate-500'}`}>
                  {m.label}
                  {m.year && (
                    <span className="ml-1.5 text-[10px] text-indigo-400/70 font-medium">{m.year}</span>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{m.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- milestone timeline ---------- */

function MilestoneTimeline({ dimensions }) {
  const events = useMemo(() => {
    const all = []
    for (const dim of dimensions) {
      for (const m of dim.milestones) {
        if (m.achieved && m.year) {
          all.push({ ...m, dimension: dim.name, dimId: dim.id })
        }
      }
    }
    all.sort((a, b) => a.year - b.year)
    return all
  }, [dimensions])

  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? events : events.slice(0, 8)

  return (
    <div>
      <div className="relative pl-6">
        {/* vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700/60" />

        {visible.map((ev, i) => (
          <div key={i} className="relative mb-4 last:mb-0">
            {/* dot */}
            <div className="absolute left-[-17px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-slate-950" />
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-indigo-400 tabular-nums w-10 flex-shrink-0">
                {ev.year}
              </span>
              <div className="min-w-0">
                <span className="text-xs text-slate-200">{ev.label}</span>
                <span className="ml-1.5 text-[10px] text-slate-500">{ev.dimension}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 8 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
        >
          {expanded ? 'Show less' : `Show all ${events.length} milestones`}
        </button>
      )}
    </div>
  )
}

/* ---------- loading skeleton ---------- */

function Skeleton() {
  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-10 flex flex-col items-center">
        <div className="w-[220px] h-[220px] rounded-full border-[14px] border-slate-800 animate-pulse" />
        <div className="h-4 w-64 bg-slate-800/60 rounded animate-pulse mt-8" />
        <div className="h-4 w-48 bg-slate-800/40 rounded animate-pulse mt-3" />
        <div className="grid gap-4 sm:grid-cols-2 w-full mt-10">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- main page ---------- */

export default function DisclosureIndex() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/data/disclosure_index.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load disclosure index:', err))
  }, [])

  if (!data) return <Skeleton />

  const { overall_score, last_updated, methodology, dimensions } = data

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      {/* Hero gauge */}
      <section className="px-4 pt-10 pb-2 sm:pt-14 flex flex-col items-center max-w-3xl mx-auto">
        <Gauge score={overall_score} />

        <p className="mt-8 text-sm sm:text-base text-slate-300 leading-relaxed text-center max-w-xl">
          Humanity has achieved approximately{' '}
          <span className="font-bold text-indigo-400">{overall_score}%</span>{' '}
          of full UAP disclosure. Significant progress in government acknowledgment and institutional
          infrastructure, but ontological disclosure — the nature of the phenomena — remains almost
          entirely opaque.
        </p>

        <p className="mt-3 text-xs text-slate-500 text-center">
          Last updated {last_updated} &middot;{' '}
          <Link to="/" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">
            Back to dashboard
          </Link>
          {' '}&middot;{' '}
          <Link to="/pulse" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">
            Pulse (public awareness)
          </Link>
          {' '}&middot;{' '}
          <Link to="/theories" className="text-indigo-400/70 hover:text-indigo-400 underline underline-offset-2">
            Origin theories
          </Link>
        </p>
      </section>

      {/* Dimension cards */}
      <section className="px-4 mt-10 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Dimensions of Disclosure</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {dimensions.map(dim => (
            <DimensionCard key={dim.id} dim={dim} />
          ))}
        </div>
      </section>

      {/* Milestone timeline */}
      <section className="px-4 mt-10 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Disclosure Timeline</h2>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Achieved milestones in chronological order, showing the arc of UAP disclosure from 2011 to present.
        </p>
        <MilestoneTimeline dimensions={dimensions} />
      </section>

      {/* Methodology */}
      <section className="px-4 mt-12 max-w-3xl mx-auto">
        <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Methodology</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{methodology}</p>
          <p className="text-[10px] text-slate-500 leading-relaxed mt-2">Scores are editorial assessments based on public records, legislation, and official statements. Not a peer-reviewed index.</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {dimensions.map(d => (
              <span key={d.id}>
                {d.name}: <span className="text-slate-400 font-medium">{d.score}</span>
                <span className="text-slate-500 ml-0.5">({(d.weight * 100).toFixed(0)}%)</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
