import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStats, useDocuments, useResearch, useInvestigations, agencyClass, agencyColor, formatDate, coverUrl } from '../hooks/useData'
import DocThumbnail from '../components/DocThumbnail'

/* ── animated counter hook ─────────────────────────────────────────── */
function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0)
  const ref = useRef()

  useEffect(() => {
    if (!target) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) ref.current = requestAnimationFrame(step)
    }
    ref.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(ref.current)
  }, [target, duration])

  return value
}

/* ── spinner ───────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-mono tracking-wider uppercase">Decrypting files...</p>
      </div>
    </div>
  )
}

/* ── CSS injected once via style tag ───────────────────────────────── */
const STYLES_ID = 'dashboard-animations'
function useDashboardStyles() {
  useEffect(() => {
    if (document.getElementById(STYLES_ID)) return
    const style = document.createElement('style')
    style.id = STYLES_ID
    style.textContent = `
      @keyframes dash-grid-scroll {
        0% { background-position: 0 0; }
        100% { background-position: 60px 60px; }
      }
      @keyframes dash-fade-up {
        0% { opacity: 0; transform: translateY(24px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes dash-bar-fill {
        0% { width: 0%; }
        100% { width: var(--bar-width); }
      }
      @keyframes dash-pulse-ring {
        0% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.15); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
      @keyframes dash-scan-line {
        0% { top: 0; opacity: 0.5; }
        50% { opacity: 0.15; }
        100% { top: 100%; opacity: 0; }
      }
      .dash-grid-bg {
        background-image:
          linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px);
        background-size: 60px 60px;
        animation: dash-grid-scroll 30s linear infinite;
      }
      .dash-card {
        opacity: 0;
        animation: dash-fade-up 0.6s ease-out forwards;
      }
      .dash-bar-animated {
        animation: dash-bar-fill 1.2s ease-out forwards;
        animation-delay: 0.3s;
        width: 0%;
      }
      .dash-pulse-ring {
        animation: dash-pulse-ring 2s ease-out infinite;
      }
      .dash-scan-line {
        animation: dash-scan-line 4s ease-in-out infinite;
      }
      .dash-carousel::-webkit-scrollbar { display: none; }
      .dash-carousel { -ms-overflow-style: none; scrollbar-width: none; }
    `
    document.head.appendChild(style)
    return () => { /* keep styles alive — single page app */ }
  }, [])
}

/* ── agency metadata ───────────────────────────────────────────────── */
const agencyMeta = {
  'Department of War': { short: 'DEPT. OF WAR', accent: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  'FBI':               { short: 'FBI',          accent: 'bg-red-500',  text: 'text-red-400',  border: 'border-red-500/30',  bg: 'bg-red-500/10' },
  'NASA':              { short: 'NASA',         accent: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  'Department of State':{ short: 'STATE DEPT.', accent: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
}

/* ── nav config ────────────────────────────────────────────────────── */
const navLinks = [
  { to: '/map',             label: 'Map',           icon: '◎', desc: 'Incident locations worldwide' },
  { to: '/timeline',        label: 'Timeline',      icon: '━', desc: 'Documents across eight decades' },
  { to: '/graph',           label: 'Graph',         icon: '◈', desc: 'Program structure & cross-references' },
  { to: '/search',          label: 'Search',        icon: '⌕', desc: 'Full-text across all files' },
  { to: '/analysis/report', label: 'Analysis',      icon: '◫', desc: 'Deep dives & detailed reports' },
  { to: '/disclosure',      label: 'Disclosure',    icon: '≡', desc: 'Disclosure progress index' },
  { to: '/theories',        label: 'Theories',      icon: '◈', desc: 'Origin hypotheses & frameworks' },
  { to: '/cases',           label: 'Cases',         icon: '◆', desc: 'Highest-validity encounters' },
  { to: '/international',   label: 'International', icon: '⊕', desc: 'Global UAP programs' },
  { to: '/pulse',           label: 'Pulse',         icon: '◌', desc: 'News & social awareness' },
]

/* ── notable document ids + compelling hooks ──────────────────────── */
const notableDocIds = [
  103, // Apollo 11 Crew Debriefing
  112, // FBI 62-HQ-83894 Section 1
  111, // Western US Event
  55,  // Apollo 17 photos
  0,   // DOW Mission Report Iraq
  106, // Skylab Crew Debriefing
  75,  // State Dept Cable Papua New Guinea
  64,  // German WWII foo fighter docs
]

const docHooks = {
  103: "Buzz Aldrin saw something tracking Apollo 11 on the way to the moon. The crew debriefing was classified for over 50 years.",
  112: "The FBI investigated UFOs for 21 years and filled 2,622 pages they never expected you to read. This is Section 1 of the complete case file.",
  111: "Seven federal employees independently reported four categories of anomalous objects over two days in the western U.S. The Pentagon compiled their statements into a single file.",
  55: "NASA photographed three dots in triangular formation in the lunar sky during Apollo 17. They opened a case to investigate — and never closed it.",
  0: "A military drone operator over Iraq filmed five unidentified objects crossing the sensor feed. The report was classified SECRET and shared with Five Eyes allies.",
  106: "All three Skylab crews reported anomalous observations in orbit. The sightings were formally logged in NASA mission reports and classified for decades.",
  75: "The U.S. Embassy in Papua New Guinea cabled the Pentagon about a UFO inquiry from the host government. The State Department's response has never been released.",
  64: "In 1944, the 415th Night Fighter Squadron reported glowing objects following their planes over Germany. The Army called them 'foo fighters' and filed 17 pages of reports.",
}

/* ── briefing card data ────────────────────────────────────────────── */
const briefingCards = [
  {
    tag: 'FINDING 01',
    label: 'GEOGRAPHIC ANALYSIS',
    title: 'Middle East Hotspot',
    stat: '26',
    unit: 'docs',
    description: 'Dense concentration of UAP encounters across CENTCOM AOR — Iraq, Syria, the Persian Gulf, and surrounding airspace.',
    expanded: 'All 26 documents originate from USCENTCOM mission reports declassified by Chief of Staff MG Richard A. Harrison between October 2025 and January 2026. The encounters span 2021–2024 across Iraq, Syria, Greece, the Mediterranean, the Persian Gulf, and the United Arab Emirates. Sensor suites include FLIR, radar, photographic, video, and SIGINT. Several reports are classified SECRET//REL TO USA, FVEY — meaning Five Eyes allies also received the data. UAP were observed during combat operations, aerial reconnaissance, and patrol missions, often by MQ-9 Reaper and manned fighter crews simultaneously. The geographic clustering around active conflict zones raises questions about whether UAP activity correlates with military operations, advanced adversary technology, or something else entirely.',
    color: 'border-t-amber-500',
  },
  {
    tag: 'FINDING 02',
    label: 'LARGEST FILE CLUSTER',
    title: 'FBI Case 62-HQ-83894',
    stat: '2,622',
    unit: 'pages',
    description: 'FBI\'s primary UAP investigation spanning 1947–1968 across 17 sections.',
    expanded: 'File 62-HQ-83894 is the FBI\'s central headquarters file on unidentified flying objects, maintained by the Domestic Intelligence Division. It spans 17 numbered sections plus sub-files and serials, totaling over 2,600 pages. The file documents field office reports from every major FBI division, coordination with the Air Force\'s Project Blue Book, and direct communications with J. Edgar Hoover\'s office. Notable contents include: radar-confirmed sightings over nuclear installations (Oak Ridge, Hanford, Los Alamos), photographic evidence from multiple field offices, the "green fireball" incidents over New Mexico that prompted Dr. Lincoln LaPaz\'s investigation, and the 1952 Washington D.C. wave where objects were tracked on radar over the Capitol. The file reveals the FBI was far more involved in UAP investigation than publicly acknowledged — Hoover personally annotated several reports with requests for more information.',
    color: 'border-t-red-500',
  },
  {
    tag: 'FINDING 03',
    label: 'SPACE ENCOUNTERS',
    title: 'Apollo & Skylab Missions',
    stat: '14',
    unit: 'NASA docs',
    description: 'Apollo 11, 12, and 17 crew debriefings plus Skylab III encounter report.',
    expanded: 'The NASA documents include official crew debriefing transcripts from Apollo 11 (Armstrong, Aldrin, Collins), Apollo 12 (Conrad, Gordon, Bean), and Apollo 17 (Cernan, Evans, Schmitt), plus the Skylab III crew observation report. During the Apollo 11 transit, the crew observed a luminous object that tracked alongside the spacecraft. Apollo 12 documented unexplained light phenomena during lunar orbit. Apollo 17 visual monitoring photographs (VM3, VM5, VM6) captured anomalous objects that NASA catalogued but could not identify. The Skylab III crew reported a triangular formation of red lights during an observation session — the sighting was formally logged in the mission report. These are not secondhand accounts — they are official transcripts from the most trained observers humanity has ever sent into space, reporting through official NASA channels to debriefers with security clearances.',
    color: 'border-t-purple-500',
  },
  {
    tag: 'FINDING 04',
    label: 'BEHAVIORAL PATTERNS',
    title: 'Anomalous Behaviors',
    stat: '147',
    unit: 'instances',
    description: 'Documented behaviors: hovering, cloaking, luminosity changes, formation flight, splitting, merging, instant acceleration, EM interference.',
    expanded: 'Across the entire corpus, 147 instances of anomalous behavior are catalogued across 8 distinct categories. Hovering (sustained stationary flight with no visible means of propulsion) appears in 42 documents. Luminosity changes (objects shifting brightness, color, or emitting sudden flashes) appear in 67. Formation flight (multiple objects maintaining geometric patterns) appears in 38. The most concerning behaviors include: splitting (a single object dividing into multiple), merging (multiple objects combining into one), and EM interference (disruption of radar, radio, or electrical systems during observation). These behaviors are reported by FBI agents, military pilots, radar operators, and astronauts independently across eight decades — from 1944 WWII "foo fighter" reports through 2024 CENTCOM mission reports. The consistency of behavioral descriptions across time, geography, and observer background is one of the strongest arguments against conventional explanations.',
    color: 'border-t-cyan-500',
  },
  {
    tag: 'FINDING 05',
    label: 'SENSOR CORROBORATION',
    title: 'Multi-Sensor Evidence',
    stat: '56',
    unit: 'docs',
    description: 'Corroborated across radar, IR/FLIR, photographic, satellite, SIGINT, and electro-optical systems.',
    expanded: '56 documents contain observations confirmed by two or more independent sensor systems. This is the gold standard in intelligence analysis — a single observer can be mistaken, but when radar, infrared, visual, photographic, and SIGINT all register the same event, conventional explanations become difficult to maintain. The strongest multi-sensor cases include: DOW mission reports where FLIR and radar simultaneously tracked objects; FBI files from the 1952 Washington wave where ground radar, airborne radar, and visual observers all confirmed the same objects; and NASA documents where photographic evidence corroborates crew visual observations. The sensor types represented span the full electromagnetic spectrum: radar (microwave), FLIR (thermal infrared), electro-optical (visible/near-IR), photographic (visible), video (visible), satellite (multi-spectral), SIGINT (radio frequency), and acoustic. No known natural phenomenon or conventional aircraft produces signatures across all these modalities simultaneously.',
    color: 'border-t-blue-500',
  },
  {
    tag: 'FINDING 06',
    label: 'TRANSPARENCY GAP',
    title: 'Redaction Pervasive',
    stat: '78',
    unit: 'docs redacted',
    description: 'Over 60% of files contain redactions even in this "declassified" release.',
    expanded: '78 of the 129 documents — over 60% — contain visible redactions ranging from single words to entire pages blacked out. Redactions are applied under FOIA exemptions including (b)(1)1.4a (classified national defense information), (b)(1)1.4g (vulnerabilities of systems), (b)(6) (personal privacy), and 3.5c (intelligence sources and methods). The Pentagon has stated that redactions "do not concern the nature or existence of any encounter" — a carefully worded assertion that raises more questions than it answers. If the encounters themselves are fully disclosed, what requires classification? Possible answers include: specific military unit identities and capabilities, sensor system specifications, operational locations of intelligence assets, and the identities of witnesses who may still be active duty. The pattern of redaction is itself analytically significant — the most heavily redacted documents tend to be the most recent (2022–2024) CENTCOM reports, while older FBI files from the 1940s–1960s are more completely released.',
    color: 'border-t-amber-600',
  },
]

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const stats = useStats()
  const docs = useDocuments()
  const research = useResearch()
  const investigations = useInvestigations()
  const navigate = useNavigate()
  const carouselRef = useRef(null)
  const [theories, setTheories] = useState(null)
  const [expandedBriefing, setExpandedBriefing] = useState(null)

  useEffect(() => {
    fetch('/data/theories.json')
      .then(r => r.json())
      .then(setTheories)
      .catch(() => {})
  }, [])

  const topTheories = useMemo(() => {
    if (!theories) return []
    return [...theories.theories].sort((a, b) => b.popularity - a.popularity).slice(0, 6)
  }, [theories])

  useDashboardStyles()

  /* animated stat counters */
  const totalDocs = stats?.total_files ?? 129
  const totalPages = stats?.total_pages ?? 4044
  const agencyCount = stats?.by_agency ? Object.keys(stats.by_agency).length : 4
  const decadeCount = stats?.by_decade ? Object.keys(stats.by_decade).filter(k => k !== 'Unknown').length : 8
  const redacted = stats?.redaction_count ?? 78

  const countDocs = useCountUp(stats ? totalDocs : 0)
  const countPages = useCountUp(stats ? totalPages : 0)
  const countAgencies = useCountUp(stats ? agencyCount : 0)
  const countDecades = useCountUp(stats ? decadeCount : 0)

  /* scroll-to-content handler */
  const contentRef = useRef(null)
  const scrollToContent = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /* carousel scroll */
  const scrollCarousel = useCallback((dir) => {
    if (!carouselRef.current) return
    const amount = dir * 300
    carouselRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }, [])

  if (!stats) return <Spinner />

  /* resolve notable docs */
  const notableDocs = notableDocIds
    .map(id => docs?.find(d => d.id === id))
    .filter(Boolean)
    .slice(0, 8)

  /* research correlations — pick top 5 most interesting */
  const researchTopics = research?.correlations
    ?.filter(c => c.sources?.length > 0)
    ?.slice(0, 5) ?? []

  return (
    <div className="bg-slate-950 min-h-dvh pb-20">

      {/* ────────────────────────────────────────────────────────────────
          HERO SECTION
          ──────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        {/* background: radial gradient + animated grid */}
        <div
          className="absolute inset-0 dash-grid-bg"
          style={{
            background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 70%)',
          }}
        />
        {/* scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent dash-scan-line"
          />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          {/* classification marker */}
          <div className="inline-flex items-center gap-2 mb-6 sm:mb-8">
            <span className="h-px w-8 bg-amber-500/40" />
            <span className="text-amber-500/80 text-[10px] sm:text-xs font-mono tracking-[0.25em] uppercase">
              Declassified // May 8, 2026
            </span>
            <span className="h-px w-8 bg-amber-500/40" />
          </div>

          {/* title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-[0.15em] sm:tracking-[0.2em] text-slate-100 uppercase">
            THE LEGACY
            <span className="block text-3xl sm:text-5xl md:text-6xl tracking-[0.15em] sm:tracking-[0.2em] mt-1 sm:mt-2 text-amber-400">
              PROGRAM
            </span>
          </h1>

          {/* subtitle */}
          <p className="mt-4 sm:mt-6 text-slate-400 text-xs sm:text-sm md:text-base font-mono tracking-wide max-w-2xl mx-auto leading-relaxed">
            Mapping the alleged multi-decade covert UAP program<br className="hidden sm:block" />
            {' '}through 129 declassified government documents
          </p>

          {/* animated stat counters */}
          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-x-3 gap-y-2 sm:gap-x-6 text-sm sm:text-base">
            <span className="text-slate-300 font-mono">
              <span className="text-amber-400 font-bold">{countDocs.toLocaleString()}</span> Documents
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300 font-mono">
              <span className="text-amber-400 font-bold">{countPages.toLocaleString()}</span> Pages
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300 font-mono">
              <span className="text-amber-400 font-bold">{countAgencies}</span> Agencies
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300 font-mono">
              <span className="text-amber-400 font-bold">{countDecades}</span> Decades
            </span>
          </div>

          {/* tagline */}
          <p className="mt-6 sm:mt-8 text-slate-500 text-xs sm:text-sm italic max-w-lg mx-auto">
            Follow the threads. See the web.
          </p>

          {/* CTA badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5 sm:mt-6">
            <Link
              to="/graph"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-shadow animate-pulse" />
              <span className="text-amber-400 text-xs sm:text-sm font-mono font-bold tracking-wider">
                Enter the Web
              </span>
            </Link>
            <Link
              to="/disclosure"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-600/30 bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
            >
              <span className="text-slate-400 text-xs sm:text-sm font-mono tracking-wider">
                Disclosure Index: 39%
              </span>
            </Link>
            <Link
              to="/theories"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-600/30 bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
            >
              <span className="text-slate-400 text-xs sm:text-sm font-mono tracking-wider">
                11 Origin Theories
              </span>
            </Link>
          </div>

          {/* explore button */}
          <div className="mt-8 sm:mt-10">
            <button
              onClick={scrollToContent}
              className="relative inline-flex items-center justify-center w-12 h-12 rounded-full border border-slate-600/50 hover:border-amber-500/50 transition-colors cursor-pointer group"
            >
              {/* pulsing ring */}
              <span className="absolute inset-0 rounded-full border border-amber-500/30 dash-pulse-ring" />
              <svg className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* source */}
          <p className="mt-4 text-[10px] text-slate-500">
            Source:{' '}
            <a
              href="https://war.gov/UFO"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-amber-400/70 underline underline-offset-2 transition-colors"
            >
              war.gov/UFO
            </a>
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          "WHAT JUST HAPPENED" CONTEXT BLOCK
          ──────────────────────────────────────────────────────────────── */}
      <section ref={contentRef} className="px-4 sm:px-6 pt-12 sm:pt-16 pb-6 max-w-2xl mx-auto text-center">
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          On May 8, 2026, the Pentagon released 162 files under the PURSUE Act — the largest
          single disclosure of UAP documents in U.S. history. Of these, 129 unique documents
          were analyzed and mapped against the alleged Legacy Program — a multi-decade covert
          system spanning surveillance, material custody, and industrial reverse-engineering
          across four agencies and eight decades.
        </p>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          FEATURED INVESTIGATIONS
          ──────────────────────────────────────────────────────────────── */}
      {investigations && investigations.length > 0 && (
        <section className="px-4 sm:px-6 py-10 sm:py-14 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
            <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-amber-500/80 whitespace-nowrap">
              Featured Investigations
            </h2>
            <span className="h-px flex-1 bg-gradient-to-l from-amber-500/40 to-transparent" />
          </div>
          <p className="text-[11px] text-slate-500 text-center mb-8">
            Curated pathways through the document collection
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {investigations.map((inv, i) => (
              <div
                key={inv.id}
                className="dash-card group relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/50 border border-slate-700/40 rounded-lg overflow-hidden hover:border-slate-500/50 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all"
                style={{ animationDelay: `${i * 100 + 100}ms` }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                  style={{ backgroundColor: inv.color }}
                />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(ellipse at top left, ${inv.color}08 0%, transparent 70%)`,
                  }}
                />
                <div className="relative p-5 pl-6">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded border"
                      style={{
                        color: inv.color,
                        borderColor: `${inv.color}30`,
                        backgroundColor: `${inv.color}10`,
                      }}
                    >
                      {inv.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {inv.related_doc_ids.length + 1} docs
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-white mb-2 transition-colors">
                    {inv.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
                    {inv.hook}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-4 line-clamp-3 group-hover:text-slate-400 transition-colors">
                    {inv.description}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link
                      to={`/documents/${inv.entry_doc_id}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-mono font-bold tracking-wider uppercase transition-all"
                      style={{
                        backgroundColor: `${inv.color}15`,
                        borderColor: `${inv.color}40`,
                        color: inv.color,
                        border: `1px solid ${inv.color}40`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${inv.color}25`
                        e.currentTarget.style.borderColor = `${inv.color}60`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = `${inv.color}15`
                        e.currentTarget.style.borderColor = `${inv.color}40`
                      }}
                    >
                      Start Investigation
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {inv.view_links.map((vl, vi) => (
                        <Link
                          key={vi}
                          to={vl.path}
                          className="text-[10px] font-mono text-slate-500 hover:text-amber-400 transition-colors"
                        >
                          {vl.label} &rarr;
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────
          THREE GUIDED ENTRY POINTS
          ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-8 sm:py-10 max-w-4xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/documents"
            className="dash-card group bg-slate-900/80 border border-slate-700/40 rounded-lg p-6 hover:border-blue-500/40 hover:bg-slate-800/60 hover:translate-y-[-1px] hover:shadow-lg transition-all text-center"
            style={{ animationDelay: '100ms' }}
          >
            <div className="text-3xl mb-3 text-blue-400 group-hover:text-blue-300 transition-colors">
              <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1.5">Read the Documents</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Browse all declassified files by agency, date, or topic.</p>
          </Link>
          <Link
            to="/graph"
            className="dash-card group bg-slate-900/80 border border-slate-700/40 rounded-lg p-6 hover:border-purple-500/40 hover:bg-slate-800/60 hover:translate-y-[-1px] hover:shadow-lg transition-all text-center"
            style={{ animationDelay: '200ms' }}
          >
            <div className="text-3xl mb-3 text-purple-400 group-hover:text-purple-300 transition-colors">
              <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1.5">Understand the Patterns</h3>
            <p className="text-xs text-slate-400 leading-relaxed">See how documents, agencies, and events connect across decades.</p>
          </Link>
          <Link
            to="/disclosure"
            className="dash-card group bg-slate-900/80 border border-slate-700/40 rounded-lg p-6 hover:border-amber-500/40 hover:bg-slate-800/60 hover:translate-y-[-1px] hover:shadow-lg transition-all text-center"
            style={{ animationDelay: '300ms' }}
          >
            <div className="text-3xl mb-3 text-amber-400 group-hover:text-amber-300 transition-colors">
              <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1.5">Track the Disclosure</h3>
            <p className="text-xs text-slate-400 leading-relaxed">How much has actually been revealed — and what's still hidden.</p>
          </Link>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          KEY INTELLIGENCE BRIEFING
          ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
          <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-amber-500/80 whitespace-nowrap">
            Key Intelligence Briefing
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-amber-500/40 to-transparent" />
        </div>
        <p className="text-[10px] text-slate-500 text-center mb-6">All statistics derived from analysis of the PURSUE document corpus. Click any card for methodology and sources.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefingCards.map((card, i) => {
            const isOpen = expandedBriefing === card.tag
            return (
              <button
                key={card.tag}
                onClick={() => setExpandedBriefing(isOpen ? null : card.tag)}
                className={`dash-card text-left bg-slate-900/80 border rounded-lg overflow-hidden border-t-2 ${card.color} cursor-pointer transition-all hover:translate-y-[-1px] hover:shadow-lg ${
                  isOpen ? 'border-amber-500/40 ring-1 ring-amber-500/20 sm:col-span-2 lg:col-span-3' : 'border-slate-700/40 hover:border-slate-600/60'
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="px-4 pt-3 pb-2 border-b border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-amber-500/70">
                    {card.tag} // {card.label}
                  </span>
                  <span className="text-[10px] text-slate-600">{isOpen ? '▾ collapse' : '▸ expand'}</span>
                </div>
                <div className="px-4 py-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-2">{card.title}</h3>
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tabular-nums">{card.stat}</span>
                    <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">{card.unit}</span>
                  </div>
                  <p className={`text-xs sm:text-sm text-slate-400 leading-relaxed ${isOpen ? '' : 'line-clamp-3'}`}>{card.description}</p>
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-800/60">
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{card.expanded}</p>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          AGENCY BREAKDOWN
          ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-10 sm:py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-px flex-1 bg-gradient-to-r from-slate-700/60 to-transparent" />
          <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-slate-500 whitespace-nowrap">
            By Agency
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-slate-700/60 to-transparent" />
        </div>

        <div className="space-y-3">
          {Object.entries(stats.by_agency ?? {})
            .sort(([, a], [, b]) => b - a)
            .map(([agency, count], i) => {
              const meta = agencyMeta[agency]
              if (!meta) return null
              const pct = ((count / totalDocs) * 100).toFixed(0)
              const color = agencyColor(agency)
              return (
                <button
                  key={agency}
                  onClick={() => navigate(`/documents?agency=${encodeURIComponent(agency)}`)}
                  className="dash-card w-full text-left group cursor-pointer"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4 hover:border-slate-600/60 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-mono font-bold tracking-wider ${meta.text}`}>
                        {meta.short}
                      </span>
                      <span className="text-sm text-slate-400 font-mono">
                        <span className="text-slate-200 font-bold">{count}</span> docs ({pct}%)
                      </span>
                    </div>
                    {/* progress bar */}
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full dash-bar-animated transition-all"
                        style={{
                          '--bar-width': `${pct}%`,
                          backgroundColor: color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          RESEARCH CONTEXT / INTELLIGENCE BRIEFING
          ──────────────────────────────────────────────────────────────── */}
      {researchTopics.length > 0 && (
        <section className="px-4 sm:px-6 py-10 sm:py-12 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
            <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-amber-500/70 whitespace-nowrap">
              Intelligence Briefing // External Context
            </h2>
            <span className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {researchTopics.map((item, i) => (
              <div
                key={item.topic}
                className="dash-card bg-slate-900/60 border border-slate-700/40 rounded-lg overflow-hidden"
                style={{ animationDelay: `${i * 100 + 200}ms` }}
              >
                {/* header stripe */}
                <div className="h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-500/20 to-transparent" />
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-200 mb-2 leading-snug">{item.topic}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-4">
                    {item.context}
                  </p>
                  {item.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.sources.slice(0, 2).map((src, si) => (
                        <a
                          key={si}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-amber-500/60 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded px-2.5 py-1 transition-colors truncate max-w-[180px]"
                        >
                          {src.title}
                        </a>
                      ))}
                      {item.sources.length > 2 && (
                        <span className="text-[10px] font-mono text-slate-600 px-1 py-0.5">
                          +{item.sources.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────
          ORIGIN THEORIES PREVIEW
          ──────────────────────────────────────────────────────────────── */}
      {theories && (
        <section className="px-4 sm:px-6 py-10 sm:py-12 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
            <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-indigo-400/80 whitespace-nowrap">
              Origin Theories // Competing Hypotheses
            </h2>
            <span className="h-px flex-1 bg-gradient-to-l from-indigo-500/30 to-transparent" />
          </div>

          <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-2xl">
            Researchers and government officials have proposed several frameworks for what these
            documents describe. None are confirmed. Here are the leading hypotheses.
          </p>

          {/* Gerb Framework callout */}
          <Link
            to="/theories"
            className="dash-card block bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-indigo-500/20 rounded-lg p-4 mb-4 hover:border-indigo-500/40 transition-colors group"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-indigo-400">Featured Framework</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-200 transition-colors mb-1">
              {theories.gerb_framework.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-2">
              {theories.gerb_framework.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {theories.gerb_framework.three_layers.map((l, i) => (
                <span key={i} className="text-[11px] font-mono text-slate-400 bg-slate-800/60 rounded px-2.5 py-1 border border-slate-700/30">
                  {l.name}
                </span>
              ))}
            </div>
          </Link>

          {/* Top theories grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            {topTheories.map((t, i) => (
              <Link
                key={t.id}
                to="/theories"
                className="dash-card bg-slate-900/60 border border-slate-700/40 rounded-lg p-4 hover:border-slate-600/60 hover:translate-y-[-1px] hover:shadow-lg transition-all group"
                style={{ animationDelay: `${i * 80 + 200}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg" style={{ color: t.color }}>{t.icon}</span>
                  <h3 className="text-sm font-bold text-slate-200 group-hover:text-slate-100 transition-colors">{t.name}</h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{t.short}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[9px] text-slate-500 w-12">Popular</span>
                      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.popularity}%`, backgroundColor: t.color }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-slate-500 w-12">Science</span>
                      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.scientific_support}%`, backgroundColor: t.color, opacity: 0.6 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Link to="/theories" className="text-xs text-indigo-400/60 hover:text-indigo-400 font-mono tracking-wider transition-colors">
            VIEW ALL {theories.theories.length} THEORIES &rarr;
          </Link>

          {/* Community Sources */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {Object.values(theories.community_sources).slice(0, 6).map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-card bg-slate-900/60 border border-slate-700/40 rounded-lg p-3 hover:border-amber-500/20 transition-colors group"
                style={{ animationDelay: `${i * 80 + 400}ms` }}
              >
                <div className="text-sm font-bold text-slate-200 group-hover:text-amber-300 transition-colors mb-1">
                  {src.name}
                </div>
                <span className="text-[11px] text-slate-600 bg-slate-800 rounded px-2 py-0.5 mb-2 inline-block">{src.type}</span>
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-1">{src.description}</p>
                {src.stats_2025 && (
                  <div className="mt-2 text-[10px] text-amber-500/70 font-mono">
                    {src.stats_2025.total_cases?.toLocaleString()} cases
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────
          QUICK NAVIGATION
          ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-10 sm:py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-px flex-1 bg-gradient-to-r from-slate-700/60 to-transparent" />
          <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-slate-500 whitespace-nowrap">
            Explore
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-slate-700/60 to-transparent" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {navLinks.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              className="dash-card bg-slate-900/60 border border-slate-700/40 rounded-lg p-4 hover:border-amber-500/30 hover:bg-slate-800/60 hover:translate-y-[-1px] hover:shadow-lg transition-all group"
              style={{ animationDelay: `${i * 60 + 100}ms` }}
            >
              <span className="text-2xl block mb-3 text-slate-600 group-hover:text-amber-400 transition-colors">
                {link.icon}
              </span>
              <div className="text-sm font-bold text-slate-200 group-hover:text-slate-100 transition-colors">
                {link.label}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">{link.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          NOTABLE DOCUMENTS CAROUSEL
          ──────────────────────────────────────────────────────────────── */}
      {notableDocs.length > 0 && (
        <section className="px-4 sm:px-6 py-10 sm:py-12 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-px w-6 sm:w-12 bg-slate-700/60 flex-shrink-0" />
              <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-slate-500 whitespace-nowrap">
                Notable Documents
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollCarousel(-1)}
                className="w-8 h-8 rounded-full border border-slate-700/50 flex items-center justify-center text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer"
                aria-label="Scroll left"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scrollCarousel(1)}
                className="w-8 h-8 rounded-full border border-slate-700/50 flex items-center justify-center text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer"
                aria-label="Scroll right"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <Link to="/documents" className="text-xs text-amber-500/60 hover:text-amber-400 font-mono tracking-wider ml-2 transition-colors">
                VIEW ALL &rarr;
              </Link>
            </div>
          </div>

          <div
            ref={carouselRef}
            className="dash-carousel scroll-container flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4"
          >
            {notableDocs.map((doc, i) => {
              const meta = doc.agency ? agencyMeta[doc.agency] : null
              const hook = docHooks[doc.id]
              return (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="dash-card flex-shrink-0 w-[280px] sm:w-[300px] snap-start bg-slate-900/70 border border-slate-700/40 rounded-lg overflow-hidden hover:border-amber-500/30 hover:translate-y-[-1px] hover:shadow-lg transition-all group"
                  style={{ animationDelay: `${i * 80 + 100}ms` }}
                >
                  <div className="relative h-36 overflow-hidden bg-slate-800/60">
                    <img
                      src={coverUrl(doc.id)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover object-top opacity-60 group-hover:opacity-80 transition-opacity"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                      {meta ? (
                        <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded ${meta.bg} ${meta.text} ${meta.border} border`}>
                          {meta.short}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">UNKNOWN</span>
                      )}
                      {doc.incident_date_parsed && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatDate(doc.incident_date_parsed)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-slate-200 group-hover:text-slate-100 leading-snug line-clamp-2 mb-2 transition-colors">
                      {doc.title}
                    </h3>
                    {hook && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{hook}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-500">
                      {doc.total_pages && <span>{doc.total_pages} pages</span>}
                      {doc.has_redaction ? (
                        <span className="text-amber-500/70">Redacted</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────
          FOOTER MARKER
          ──────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-800/60" />
          <span className="text-[10px] font-mono tracking-[0.2em] text-slate-700 uppercase">
            End of briefing
          </span>
          <span className="h-px flex-1 bg-slate-800/60" />
        </div>
      </div>
    </div>
  )
}
