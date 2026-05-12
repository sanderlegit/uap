import { useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'

import { useExplorationTrail } from '../hooks/useExplorationTrail'

const primaryNav = [
  { to: '/theories', label: 'The Legacy Program', icon: '◈' },
  { to: '/graph', label: 'Graph', icon: '◈' },
  { to: '/documents', label: 'Documents', icon: '◫' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/timeline', label: 'Timeline', icon: '━' },
  { to: '/search', label: 'Search', icon: '⌕' },
]

const bottomNav = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/theories', label: 'Briefing', icon: '◈' },
  { to: '/documents', label: 'Docs', icon: '◫' },
  { to: '/graph', label: 'Graph', icon: '◈' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/timeline', label: 'Timeline', icon: '━' },
]


const breadcrumbMeta = {
  '/graph': { label: 'Graph', hint: 'Legacy Program structure and document cross-references in one network.' },
  '/documents': { label: 'Documents', hint: 'Browse all 129 declassified files by agency, date, or topic.' },
  '/map': { label: 'Map', hint: 'Incident locations plotted from document coordinates worldwide.' },
  '/timeline': { label: 'Timeline', hint: '99 dated documents spanning 1945 to present.' },
  '/search': { label: 'Search', hint: 'Full-text search across all declassified document content.' },
  '/disclosure': { label: 'Disclosure Index', hint: 'A composite measure of how much the government has officially acknowledged about UAP.' },
  '/theories': { label: 'The Legacy Program', hint: 'The big picture — theories, evidence, and pathways into the archive.' },
  '/cases': { label: 'Cases', hint: 'The highest-validity UAP encounters with multi-source evidence.' },
  '/entities': { label: 'Entities', hint: 'Investigate by organization, person, or location across all documents.' },
  '/international': { label: 'International', hint: 'Global UAP programs and how other governments are responding.' },
  '/pulse': { label: 'Pulse', hint: 'Tracking public, political, and scientific momentum around UAP disclosure.' },
  '/vocabulary': { label: 'Vocabulary', hint: 'Every word is a worldview. The loaded lexicon of UAP discourse mapped across 4,058 pages.' },
}

function Breadcrumb() {
  const location = useLocation()
  const path = location.pathname

  if (path === '/') return null

  const isDocDetail = path.startsWith('/documents/') && path !== '/documents'
  const isAnalysis = path.startsWith('/analysis/')

  let crumbs = [{ to: '/', label: 'Home' }]
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


export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="app-top-bar hidden md:block sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <span className="text-amber-500 text-lg tracking-[0.15em]">CENTRAL DISCLOSURE AGENCY</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end
              className={({isActive}) => `px-2 py-1.5 rounded text-base transition-colors ${isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-200'}`}
              title="Home">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </NavLink>
            {primaryNav.map(n => (
              <NavLink key={n.to} to={n.to}
                className={({isActive}) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-slate-200'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="md:hidden" />
        </div>
      </header>
      <Breadcrumb />
      <ExplorationTrail />
      <main className="flex-1 relative pb-16 md:pb-0">
        <Outlet />
      </main>
      {menuOpen && (
        <nav className="app-mobile-menu md:hidden fixed bottom-14 inset-x-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 pb-3 pt-2 safe-area-pb">
          <NavLink to="/search"
            onClick={() => setMenuOpen(false)}
            className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded text-sm ${isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-300'}`}>
            <span className="text-base w-5 text-center">⌕</span>Search
          </NavLink>
        </nav>
      )}
      <nav className="app-bottom-bar md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-pb">
        <div className="flex justify-around items-center h-14 px-1">
          {bottomNav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              onClick={() => setMenuOpen(false)}
              className={({isActive}) => `flex flex-col items-center gap-0.5 px-1 py-2 min-w-[38px] ${isActive ? 'text-primary-light' : 'text-slate-500'}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[9px]">{n.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`flex flex-col items-center gap-0.5 px-1 py-2 min-w-[38px] cursor-pointer ${menuOpen ? 'text-primary-light' : 'text-slate-500'}`}
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            <span className="text-base">{menuOpen ? '✕' : '☰'}</span>
            <span className="text-[9px]">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
