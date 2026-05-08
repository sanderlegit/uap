import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/documents', label: 'Documents', icon: '◫' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/timeline', label: 'Timeline', icon: '━' },
  { to: '/graph', label: 'Graph', icon: '⬡' },
  { to: '/search', label: 'Search', icon: '⌕' },
]

const insightsNav = [
  { to: '/disclosure', label: 'Disclosure Index', icon: '%', activeBg: 'bg-purple-500/20', activeText: 'text-purple-300' },
  { to: '/theories', label: 'Theories', icon: '◈', activeBg: 'bg-indigo-500/20', activeText: 'text-indigo-300' },
  { to: '/cases', label: 'Cases', icon: '◆', activeBg: 'bg-red-500/20', activeText: 'text-red-300' },
  { to: '/international', label: 'International', icon: '⊕', activeBg: 'bg-emerald-500/20', activeText: 'text-emerald-300' },
  { to: '/pulse', label: 'Pulse', icon: '◌', activeBg: 'bg-cyan-500/20', activeText: 'text-cyan-300' },
]

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
            <span className="text-primary text-lg">PURSUE</span>
            <span className="text-slate-400 hidden sm:inline">UAP Document Explorer</span>
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
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-pb">
        <div className="flex justify-around items-center h-14 px-2">
          {primaryNav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({isActive}) => `flex flex-col items-center gap-0.5 px-2 py-1 ${isActive ? 'text-primary-light' : 'text-slate-500'}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[10px]">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
