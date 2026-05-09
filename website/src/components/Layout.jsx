import { useState, useRef, useEffect, useMemo } from 'react'
import { Outlet, NavLink, Link, useLocation, useParams } from 'react-router-dom'
import WelcomeBanner from './WelcomeBanner'
import ChatPanel from './ChatPanel'
import { useExplorationTrail } from '../hooks/useExplorationTrail'

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/graph', label: 'Graph', icon: '◈' },
  { to: '/documents', label: 'Documents', icon: '◫' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/timeline', label: 'Timeline', icon: '━' },
  { to: '/search', label: 'Search', icon: '⌕' },
]

const insightsNav = [
  { to: '/disclosure', label: 'Disclosure Index', icon: '%', activeBg: 'bg-purple-500/20', activeText: 'text-purple-300' },
  { to: '/theories', label: 'Theories', icon: '◈', activeBg: 'bg-indigo-500/20', activeText: 'text-indigo-300' },
  { to: '/cases', label: 'Cases', icon: '◆', activeBg: 'bg-red-500/20', activeText: 'text-red-300' },
  { to: '/entities', label: 'Entities', icon: '▣', activeBg: 'bg-amber-500/20', activeText: 'text-amber-300' },
  { to: '/international', label: 'International', icon: '⊕', activeBg: 'bg-emerald-500/20', activeText: 'text-emerald-300' },
  { to: '/pulse', label: 'Pulse', icon: '◌', activeBg: 'bg-cyan-500/20', activeText: 'text-cyan-300' },
]

const breadcrumbMeta = {
  '/graph': { label: 'Graph', hint: 'Legacy Program structure and document cross-references in one network.' },
  '/documents': { label: 'Documents', hint: 'Browse all 129 declassified files by agency, date, or topic.' },
  '/map': { label: 'Map', hint: 'Incident locations plotted from document coordinates worldwide.' },
  '/timeline': { label: 'Timeline', hint: '99 dated documents spanning 1945 to present.' },
  '/search': { label: 'Search', hint: 'Full-text search across all declassified document content.' },
  '/disclosure': { label: 'Disclosure Index', hint: 'A composite measure of how much the government has officially acknowledged about UAP.' },
  '/theories': { label: 'Theories', hint: 'Competing hypotheses for what these documents describe.' },
  '/cases': { label: 'Cases', hint: 'The highest-validity UAP encounters with multi-source evidence.' },
  '/entities': { label: 'Entities', hint: 'Investigate by organization, person, or location across all documents.' },
  '/international': { label: 'International', hint: 'Global UAP programs and how other governments are responding.' },
  '/pulse': { label: 'Pulse', hint: 'Tracking public, political, and scientific momentum around UAP disclosure.' },
}

function Breadcrumb() {
  const location = useLocation()
  const path = location.pathname

  if (path === '/') return null

  const isDocDetail = path.startsWith('/documents/') && path !== '/documents'
  const isAnalysis = path.startsWith('/analysis/')

  let crumbs = [{ to: '/', label: 'Dashboard' }]
  let hint = null

  if (isDocDetail) {
    crumbs.push({ to: '/documents', label: 'Documents' })
  } else if (isAnalysis) {
    crumbs.push({ to: '/analysis/report', label: 'Analysis' })
  } else if (breadcrumbMeta[path]) {
    hint = breadcrumbMeta[path].hint
  }

  const current = isDocDetail ? null
    : isAnalysis ? null
    : breadcrumbMeta[path]?.label || path.slice(1)

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 py-1 flex items-center gap-2 flex-wrap">
        {crumbs.map((c, i) => (
          <span key={c.to} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-600 text-xs">/</span>}
            <Link to={c.to} className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5">{c.label}</Link>
          </span>
        ))}
        {current && (
          <>
            <span className="text-slate-600 text-xs">/</span>
            <span className="text-xs text-slate-300">{current}</span>
          </>
        )}
        {hint && (
          <span className="text-[11px] text-slate-500 ml-2 hidden sm:inline">{hint}</span>
        )}
      </div>
    </div>
  )
}

function TypeIcon({ type }) {
  if (type === 'document') {
    return (
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="1" width="10" height="14" rx="1" />
        <line x1="5.5" y1="5" x2="10.5" y2="5" />
        <line x1="5.5" y1="8" x2="10.5" y2="8" />
        <line x1="5.5" y1="11" x2="8.5" y2="11" />
      </svg>
    )
  }
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="12" height="10" rx="1" />
      <path d="M4 4V3a1 1 0 011-1h6a1 1 0 011 1v1" />
      <line x1="5" y1="8" x2="11" y2="8" />
    </svg>
  )
}

function ExplorationTrail() {
  const { trail, clearTrail } = useExplorationTrail()

  if (!trail || trail.length === 0) return null

  return (
    <div className="bg-slate-900/40 border-b border-slate-800/30">
      <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center gap-2">
        <span className="text-[11px] text-slate-500 shrink-0">Recent:</span>
        <div className="flex-1 overflow-x-auto flex items-center gap-1.5 scrollbar-hide">
          {trail.map(item => (
            <Link
              key={`${item.type}:${item.id}`}
              to={item.path}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors shrink-0 text-xs"
            >
              <TypeIcon type={item.type} />
              <span>{item.title.length > 25 ? item.title.slice(0, 25) + '...' : item.title}</span>
            </Link>
          ))}
        </div>
        <button
          onClick={clearTrail}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 text-xs w-8 h-8 flex items-center justify-center cursor-pointer"
          title="Clear recent trail"
        >
          &times;
        </button>
      </div>
    </div>
  )
}

function InsightsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const isInsightActive = insightsNav.some(n => location.pathname === n.to || location.pathname.startsWith(n.to + '/'))

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => { setOpen(false) }, [location.pathname])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
          isInsightActive ? 'bg-accent/20 text-accent-light' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Insights
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
          {insightsNav.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({isActive}) => `flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                isActive ? `${n.activeBg} ${n.activeText}` : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}>
              <span className="w-4 text-center text-sm">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <span className="text-amber-500 text-lg tracking-[0.15em]">THE LEGACY PROGRAM</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {primaryNav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({isActive}) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-slate-200'}`}>
                {n.label}
              </NavLink>
            ))}
            <InsightsDropdown />
            <NavLink to="/analysis/report"
              className={({isActive}) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive || location.pathname.startsWith('/analysis') ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-slate-200'}`}>
              Analysis
            </NavLink>
          </nav>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-slate-400">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pb-3 pt-2 flex flex-col gap-1">
            {primaryNav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-300'}`}>
                <span className="text-base w-5 text-center">{n.icon}</span>{n.label}
              </NavLink>
            ))}
            <div className="mt-1 mb-1 border-t border-slate-800" />
            <span className="px-3 text-[10px] font-mono tracking-widest uppercase text-slate-600 mb-1">Insights</span>
            {insightsNav.map(n => (
              <NavLink key={n.to} to={n.to}
                onClick={() => setMenuOpen(false)}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm ${isActive ? `${n.activeBg} ${n.activeText}` : 'text-slate-300'}`}>
                <span className="text-base w-5 text-center">{n.icon}</span>{n.label}
              </NavLink>
            ))}
            <div className="mt-1 mb-1 border-t border-slate-800" />
            <span className="px-3 text-[10px] font-mono tracking-widest uppercase text-slate-600 mb-1">Analysis</span>
            {['report', 'fbi', 'apollo', 'redactions', 'high_interest'].map(s => (
              <NavLink key={s} to={`/analysis/${s}`}
                onClick={() => setMenuOpen(false)}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm pl-8 ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-400'}`}>
                {s === 'report' ? 'Full Report' : s === 'fbi' ? 'FBI Deep Dive' : s === 'apollo' ? 'Apollo Deep Dive' : s === 'redactions' ? 'Redaction Analysis' : 'High Interest Cases'}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      {location.pathname === '/' && <WelcomeBanner />}
      <Breadcrumb />
      <ExplorationTrail />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-pb">
        <div className="flex justify-around items-center h-14 px-2">
          {primaryNav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({isActive}) => `flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] ${isActive ? 'text-primary-light' : 'text-slate-500'}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[10px]">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <ChatPanel />
    </div>
  )
}
