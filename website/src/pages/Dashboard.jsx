import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStats, useDocuments, useInvestigations, agencyColor, formatDate, coverUrl } from '../hooks/useData'
import DocThumbnail from '../components/DocThumbnail'
import useDocPrefs from '../hooks/useDocPrefs'

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
        <p className="text-slate-500 text-sm">Loading...</p>
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
      @keyframes dash-fade-up {
        0% { opacity: 0; transform: translateY(24px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes dash-bar-fill {
        0% { width: 0%; }
        100% { width: var(--bar-width); }
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
      .dash-carousel::-webkit-scrollbar { display: none; }
      .dash-carousel { -ms-overflow-style: none; scrollbar-width: none; }
    `
    document.head.appendChild(style)
    return () => {}
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
  { to: '/documents',      label: 'Documents',     icon: '◫', desc: 'Browse all 129 declassified files' },
  { to: '/map',             label: 'Map',           icon: '◎', desc: 'Incident locations worldwide' },
  { to: '/timeline',        label: 'Timeline',      icon: '━', desc: 'Documents across eight decades' },
  { to: '/graph',           label: 'Graph',         icon: '◈', desc: 'Program structure & cross-references' },
  { to: '/search',          label: 'Search',        icon: '⌕', desc: 'Full-text across all files' },
  { to: '/analysis/report', label: 'Analysis',      icon: '◫', desc: 'Deep dives & detailed reports' },
  { to: '/cases',           label: 'Cases',         icon: '◆', desc: 'Highest-validity encounters' },
  { to: '/international',   label: 'International', icon: '⊕', desc: 'Global UAP programs' },
  { to: '/pulse',           label: 'Pulse',         icon: '◌', desc: 'News & social awareness' },
]

/* ── notable document ids — most gripping first ──────────────────── */
const notableDocIds = [
  103, // Apollo 11 Crew Debriefing — spotlight
  55,  // Apollo 17 photos
  112, // FBI 62-HQ-83894 Section 1
  0,   // DOW Mission Report Iraq
  111, // Western US Event
  64,  // German WWII foo fighter docs
  106, // Skylab Crew Debriefing
  75,  // State Dept Cable Papua New Guinea
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
    links: [
      { label: 'View on Map', path: '/map' },
      { label: 'Browse Documents', path: '/documents?agency=Department+of+War' },
      { label: 'Full Analysis', path: '/analysis/report' },
    ],
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
    links: [
      { label: 'FBI Deep Dive', path: '/analysis/fbi' },
      { label: 'Browse FBI Files', path: '/documents?agency=FBI' },
      { label: 'Open Case File', path: '/documents/112' },
    ],
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
    links: [
      { label: 'Apollo Deep Dive', path: '/analysis/apollo' },
      { label: 'Browse NASA Docs', path: '/documents?agency=NASA' },
      { label: 'View on Timeline', path: '/timeline?doc=103' },
    ],
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
    links: [
      { label: 'High Interest Cases', path: '/analysis/high_interest' },
      { label: 'Explore Network', path: '/graph' },
      { label: 'Full Report', path: '/analysis/report' },
    ],
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
    links: [
      { label: 'Browse All Documents', path: '/documents' },
      { label: 'Full Report', path: '/analysis/report' },
      { label: 'View on Map', path: '/map' },
    ],
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
    links: [
      { label: 'Redaction Analysis', path: '/analysis/redactions' },
      { label: 'Disclosure Index', path: '/disclosure' },
      { label: 'Browse All Documents', path: '/documents' },
    ],
  },
]

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const stats = useStats()
  const docs = useDocuments()
  const investigations = useInvestigations()
  const carouselRef = useRef(null)
  const [expandedBriefing, setExpandedBriefing] = useState(null)
  const { isRead, isStarred, toggleStar } = useDocPrefs()

  useDashboardStyles()

  const totalDocs = stats?.total_files ?? 129
  const totalPages = stats?.total_pages ?? 4044
  const agencyCount = stats?.by_agency ? Object.keys(stats.by_agency).length : 4
  const decadeCount = stats?.by_decade ? Object.keys(stats.by_decade).filter(k => k !== 'Unknown').length : 8

  const countDocs = useCountUp(stats ? totalDocs : 0)
  const countPages = useCountUp(stats ? totalPages : 0)
  const countAgencies = useCountUp(stats ? agencyCount : 0)
  const countDecades = useCountUp(stats ? decadeCount : 0)

  const scrollCarousel = useCallback((dir) => {
    if (!carouselRef.current) return
    carouselRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }, [])

  if (!stats) return <Spinner />

  const notableDocs = notableDocIds
    .map(id => docs?.find(d => d.id === id))
    .filter(Boolean)
    .slice(0, 8)

  const spotlightDoc = notableDocs[0]
  const spotlightMeta = spotlightDoc?.agency ? agencyMeta[spotlightDoc.agency] : null
  const carouselDocs = notableDocs.slice(1)

  return (
    <div className="bg-slate-950 min-h-dvh pb-20">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10 max-w-4xl mx-auto text-center">
        <p className="text-amber-500/70 text-[10px] sm:text-xs font-mono tracking-[0.2em] uppercase mb-4">
          Declassified May 8, 2026
        </p>

        <h1 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-3">
          129 UAP documents. Four agencies. Nine decades.
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-6">
          On May 8, 2026, the Pentagon released 162 files under the PURSUE Act — the largest
          single disclosure of UAP documents in U.S. history. This site maps the 129 unique
          documents against the alleged Legacy Program.
        </p>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm mb-8">
          <span className="text-slate-300 font-mono">
            <span className="text-amber-400 font-bold">{countDocs.toLocaleString()}</span> Documents
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-mono">
            <span className="text-amber-400 font-bold">{countPages.toLocaleString()}</span> Pages
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-mono">
            <span className="text-amber-400 font-bold">{countAgencies}</span> Agencies
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-mono">
            <span className="text-amber-400 font-bold">{countDecades}</span> Decades
          </span>
        </div>

        <Link
          to="/theories"
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors group"
        >
          <span className="text-amber-400 text-sm font-semibold">The Legacy Program</span>
          <svg className="w-4 h-4 text-amber-500/60 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>

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
      </section>

      {/* ────────────────────────────────────────────────────────────────
          NOTABLE DOCUMENTS — cold open, right after hero
          ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-10 sm:py-14 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <span className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
          <h2 className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-amber-500/80 whitespace-nowrap">
            Declassified Evidence
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-amber-500/40 to-transparent" />
        </div>
        <p className="text-[11px] text-slate-500 text-center mb-8">
          Primary sources from four federal agencies spanning eight decades
        </p>

        {/* Spotlight — first notable doc */}
        {spotlightDoc && (
          <Link
            to={`/documents/${spotlightDoc.id}`}
            className="dash-card block bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/50 border border-slate-700/40 rounded-xl overflow-hidden hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 transition-all group mb-6"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex flex-col sm:flex-row">
              <div className="relative sm:w-72 lg:w-80 h-48 sm:h-auto min-h-[200px] overflow-hidden bg-slate-800/60 shrink-0">
                <img
                  src={coverUrl(spotlightDoc.id)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover object-top opacity-70 group-hover:opacity-90 group-hover:scale-[1.02] transition-all duration-500"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900/80 hidden sm:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent sm:hidden" />
              </div>
              <div className="flex-1 p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-3">
                  {spotlightMeta && (
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded ${spotlightMeta.bg} ${spotlightMeta.text} ${spotlightMeta.border} border`}>
                      {spotlightMeta.short}
                    </span>
                  )}
                  {spotlightDoc.incident_date_parsed && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(spotlightDoc.incident_date_parsed)}
                    </span>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-100 group-hover:text-white mb-3 leading-snug transition-colors">
                  {spotlightDoc.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors mb-4">
                  {docHooks[spotlightDoc.id]}
                </p>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-amber-400 group-hover:text-amber-300 transition-colors">
                    {isRead(spotlightDoc.id) ? 'Read Again' : 'Read the Document'}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {spotlightDoc.total_pages && <span>{spotlightDoc.total_pages} pages</span>}
                    {isRead(spotlightDoc.id) && (
                      <span className="flex items-center gap-0.5 text-emerald-500/70">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Read
                      </span>
                    )}
                    {spotlightDoc.has_redaction && <span className="text-amber-500/70">Redacted</span>}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Carousel — remaining notable docs */}
        {carouselDocs.length > 0 && (
          <>
            <div className="flex items-center justify-end gap-2 mb-3">
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

            <div
              ref={carouselRef}
              className="dash-carousel scroll-container flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4"
            >
              {carouselDocs.map((doc, i) => {
                const meta = doc.agency ? agencyMeta[doc.agency] : null
                const hook = docHooks[doc.id]
                const read = isRead(doc.id)
                const starred = isStarred(doc.id)
                return (
                  <div key={doc.id} className="relative flex-shrink-0 w-[280px] sm:w-[300px] snap-start dash-card" style={{ animationDelay: `${i * 80 + 200}ms` }}>
                    <Link
                      to={`/documents/${doc.id}`}
                      className={`block rounded-lg overflow-hidden hover:translate-y-[-1px] hover:shadow-lg transition-all group ${
                        read
                          ? 'bg-slate-900/50 border border-slate-700/25 hover:border-slate-600/40'
                          : 'bg-slate-900/70 border border-slate-700/40 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="relative h-36 overflow-hidden bg-slate-800/60">
                        <img
                          src={coverUrl(doc.id)}
                          alt=""
                          loading="lazy"
                          className={`w-full h-full object-cover object-top group-hover:opacity-80 transition-opacity ${read ? 'opacity-40' : 'opacity-60'}`}
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
                      <div className="p-4 pr-9">
                        <h3 className={`text-sm font-semibold leading-snug line-clamp-2 mb-2 transition-colors ${read ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-200 group-hover:text-slate-100'}`}>
                          {doc.title}
                        </h3>
                        {hook && (
                          <p className={`text-xs leading-relaxed line-clamp-3 ${read ? 'text-slate-500' : 'text-slate-400'}`}>{hook}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-500">
                          {doc.total_pages && <span>{doc.total_pages} pages</span>}
                          {doc.has_redaction ? (
                            <span className="text-amber-500/70">Redacted</span>
                          ) : null}
                          {read && (
                            <span className="flex items-center gap-0.5 text-emerald-500/60">
                              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Read
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStar(doc.id) }}
                      className="absolute top-[152px] right-2 w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-800/60 transition-colors cursor-pointer z-10 group/star"
                      title={starred ? 'Remove from starred' : 'Star this document'}
                    >
                      {starred ? (
                        <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-slate-600 group-hover/star:text-amber-400/60 transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
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
                  <div className="flex gap-4 mb-3">
                    <DocThumbnail docId={inv.entry_doc_id} size="md" className="rounded-md shadow-lg shadow-black/30 border border-slate-700/50" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-white mb-2 transition-colors">
                        {inv.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {inv.hook}
                      </p>
                    </div>
                  </div>
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
              <div
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
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">{card.expanded}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {card.links.map((lnk, li) => (
                          <Link
                            key={li}
                            to={lnk.path}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-mono text-amber-500/70 hover:text-amber-300 transition-colors"
                          >
                            {lnk.label} &rarr;
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
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

    </div>
  )
}
