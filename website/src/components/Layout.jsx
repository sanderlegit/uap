import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/documents', label: 'Documents', icon: '◫' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/timeline', label: 'Timeline', icon: '━' },
  { to: '/graph', label: 'Graph', icon: '⬡' },
  { to: '/search', label: 'Search', icon: '⌕' },
]

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
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({isActive}) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-slate-200'}`}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/disclosure"
              className={({isActive}) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-slate-200'}`}>
              Disclosure Index
            </NavLink>
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
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-300'}`}>
                <span className="text-base w-5 text-center">{n.icon}</span>{n.label}
              </NavLink>
            ))}
            <NavLink to="/disclosure"
              onClick={() => setMenuOpen(false)}
              className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm ${isActive ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300'}`}>
              <span className="text-base w-5 text-center">%</span>Disclosure Index
            </NavLink>
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
          {nav.slice(0, 5).map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({isActive}) => `flex flex-col items-center gap-0.5 px-2 py-1 ${isActive ? 'text-primary-light' : 'text-slate-500'}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[10px]">{n.label}</span>
            </NavLink>
          ))}
          <NavLink to="/search"
            className={({isActive}) => `flex flex-col items-center gap-0.5 px-2 py-1 ${isActive ? 'text-primary-light' : 'text-slate-500'}`}>
            <span className="text-base">⌕</span>
            <span className="text-[10px]">Search</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
