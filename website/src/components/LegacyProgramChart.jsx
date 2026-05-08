import { useState, useRef, useEffect } from 'react'

const LAYER_COLORS = ['#3b82f6', '#f59e0b', '#ef4444']
const LAYER_BG = ['rgba(59,130,246,0.08)', 'rgba(245,158,11,0.08)', 'rgba(239,68,68,0.08)']

function Tooltip({ node, position, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!node) return null

  return (
    <div
      ref={ref}
      className="absolute z-50 w-72 bg-slate-800 border border-slate-600/50 rounded-lg shadow-2xl shadow-black/40 p-4"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, 8px)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-slate-100">{node.name}</h4>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer">✕</button>
      </div>
      {node.role && <p className="text-[11px] text-indigo-400 mb-1.5">{node.role}</p>}
      {node.agency && <p className="text-[11px] text-slate-400 mb-1.5">{node.agency}</p>}
      <p className="text-xs text-slate-400 leading-relaxed">{node.detail}</p>
      {node.evidence && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Evidence</span>
          <p className="text-[11px] text-slate-400 mt-0.5">{node.evidence}</p>
        </div>
      )}
      {node.connections && node.connections.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Connections</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {node.connections.map((c, i) => (
              <span key={i} className="text-[10px] text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.5">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChartNode({ node, color, bg, onClick, isActive }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left px-3 py-2 rounded-lg border transition-all cursor-pointer group ${
        isActive
          ? 'border-indigo-400/60 bg-indigo-500/10 ring-1 ring-indigo-500/30'
          : 'border-slate-700/50 hover:border-slate-600 bg-slate-900/80 hover:bg-slate-800/60'
      }`}
      style={isActive ? {} : { borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug">
        {node.name}
      </div>
      {node.role && (
        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{node.role}</div>
      )}
    </button>
  )
}

function LayerSection({ layer, index, activeNode, onNodeClick }) {
  const color = LAYER_COLORS[index]
  const bg = LAYER_BG[index]

  return (
    <div className="relative">
      {/* Layer header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {index + 1}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-200">{layer.name}</h3>
          <p className="text-[10px] text-slate-500">{layer.lead}</p>
        </div>
      </div>

      {/* Agencies */}
      <div className="ml-4 pl-4 border-l-2 space-y-4" style={{ borderColor: `${color}30` }}>
        {layer.agencies.map((agency, ai) => (
          <div key={ai}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-slate-300">{agency.name}</span>
            </div>

            {/* Nodes grid */}
            <div className="grid gap-1.5 sm:grid-cols-2 ml-4">
              {agency.nodes.map((node, ni) => (
                <ChartNode
                  key={ni}
                  node={node}
                  color={color}
                  bg={bg}
                  isActive={activeNode?.name === node.name}
                  onClick={(e) => onNodeClick(node, e)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Facilities */}
        {layer.facilities && layer.facilities.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.5 }} />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Facilities</span>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-4">
              {layer.facilities.map((f, fi) => (
                <button
                  key={fi}
                  onClick={(e) => onNodeClick(f, e)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all cursor-pointer ${
                    activeNode?.name === f.name
                      ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-700/40 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PersonnelNetwork({ personnel, activeNode, onNodeClick }) {
  return (
    <div className="mt-6 pt-4 border-t border-slate-800">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Personnel Network — The Revolving Door
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {personnel.map((p, i) => (
          <button
            key={i}
            onClick={(e) => onNodeClick(p, e)}
            className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer group ${
              activeNode?.name === p.name
                ? 'border-indigo-400/60 bg-indigo-500/10'
                : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                {p.name.split(' ').map(w => w[0]).join('')}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">{p.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{p.role}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProcessFlow({ steps }) {
  return (
    <div className="mt-6 pt-4 border-t border-slate-800">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Recovery Process — Kill Chain
      </h3>
      <div className="flex flex-col sm:flex-row gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 relative">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold text-slate-300">{step.name}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{step.detail}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-slate-600 text-xs">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const CHART_DATA = {
  layers: [
    {
      name: 'Surveillance Layer',
      lead: 'National Reconnaissance Office (NRO)',
      agencies: [
        {
          name: 'NRO — Detection & Tracking',
          nodes: [
            { name: 'Sentient AI', role: 'Autonomous detection system', detail: 'AI program that continuously monitors global sensor data for anomalous signatures. Flags events for human review and satellite retasking.', evidence: 'NRO FOIA Document C05136331 (May 2021)' },
            { name: 'Immaculate Constellation', role: 'Satellite retasking program', detail: 'When Sentient flags an anomaly, this program retasks NRO satellites to track and characterize the object. Catalogs every kinetic engagement between military assets and UAP.', evidence: 'DoD stated it has "no record" of this program; whistleblowers insist it exists' },
          ],
        },
        {
          name: 'CIA — Coordination & Foreign Recovery',
          nodes: [
            { name: 'Office of Global Access', role: 'Foreign retrieval coordination', detail: 'CIA division that coordinates recovery of foreign technology and UAP materials outside U.S. territory. Works with JSOC for physical recovery operations.', connections: ['JSOC', 'NRO', 'DOE/OST'] },
            { name: 'DS&T', role: 'Directorate of Science & Technology', detail: 'CIA\'s technical division. In 2011, blocked Lockheed VP James Ryder\'s attempt to transfer UAP hardware to DIA\'s AAWSAP program (Kona Blue).', evidence: 'AARO historical record references Kona Blue proposal' },
          ],
        },
      ],
      facilities: [
        { name: 'NRO HQ (Chantilly, VA)', detail: 'Headquarters of the National Reconnaissance Office. Manages satellite constellation and Sentient AI system.' },
      ],
    },
    {
      name: 'Custodial Layer',
      lead: 'Department of Energy / National Labs',
      agencies: [
        {
          name: 'DOE — Storage & Classification',
          nodes: [
            { name: 'Office of Secure Transport', role: 'Material transport teams', detail: 'Teams identified by DOE rain jackets and black fatigues. Dispatched to recovery sites, sometimes in full MOPP gear (chemical/biological protection). The first responders to crash sites.', connections: ['NEST', 'Sandia'] },
            { name: 'NEST Teams', role: 'Nuclear Emergency Support Team', detail: 'Founded under 1954 Atomic Energy Act authority. Teams with expertise in handling exotic materials. Authority overlaps with UAP material classification as "transclassified foreign nuclear material."', evidence: 'Atomic Energy Act of 1954 (42 U.S.C. § 2011)' },
          ],
        },
        {
          name: 'FFRDCs — Federally Funded Research Centers',
          nodes: [
            { name: 'Sandia National Labs', role: 'Primary material storage hub', detail: 'Operates as the main storage facility under FFRDC protection. Lockheed contractors access materials here without corporate inventory recording. FFRDC status provides additional legal shield.', connections: ['Lockheed Martin', 'DOE'] },
            { name: 'MITRE Corporation', role: 'Program manager & oversight', detail: 'Called "the most overlooked entity in this entire subject" by UAP Gerb. Acts as program manager and consultant, providing oversight to contractors. Revolving door with NRO and CIA DS&T.', connections: ['NRO', 'CIA DS&T', 'All contractors'] },
            { name: 'Oak Ridge / Battelle', role: 'Analysis & examination', detail: 'AARO sent materials to Oak Ridge for analysis. Former AARO chief Sean Kirkpatrick departed to become CTO at Oak Ridge — the "job carousel" that keeps oversight internal.', evidence: 'Kirkpatrick appointment reported Dec 2023' },
          ],
        },
      ],
      facilities: [
        { name: 'Sandia Labs (Albuquerque, NM)', detail: 'Primary storage location for recovered materials under FFRDC nuclear facility protection.' },
        { name: 'Los Alamos (NM)', detail: 'Nuclear weapons lab with historical ties to UAP material analysis since Manhattan Project era.' },
        { name: 'Oak Ridge (TN)', detail: 'Analysis facility. Operated by UT-Battelle. Former AARO chief moved here after tenure.' },
      ],
    },
    {
      name: 'Industrial Layer',
      lead: 'Defense Contractors',
      agencies: [
        {
          name: 'Lockheed Martin — Skunk Works',
          nodes: [
            { name: 'Skunk Works', role: 'Advanced Development Programs', detail: 'Lockheed\'s secretive division responsible for U-2, SR-71, F-117, and allegedly UAP reverse-engineering. Known for operating outside normal procurement processes.', connections: ['Sandia', 'Tonopah Test Range'] },
            { name: 'IRAD Billing', role: 'Independent R&D funding', detail: 'Lockheed uses Internal Research and Development billing for unmarked aerospace research. Money never appears in congressional appropriations. Provides plausible deniability for UAP programs.', evidence: 'GAO Report NSIAD-86-191 found 1,400+ discrepancies in Lockheed Burbank programs (1986)' },
          ],
        },
        {
          name: 'Northrop Grumman',
          nodes: [
            { name: 'Advanced Programs', role: 'Reverse engineering & prototyping', detail: 'UAP Gerb\'s Northrop project analyzes decades of acquisitions (TRW, Teledyne Ryan, BDM), alleged program locations, and whistleblower testimony surrounding Northrop UAP operations.', connections: ['Sandia', 'Area 51'] },
          ],
        },
        {
          name: 'SAIC & Others',
          nodes: [
            { name: 'SAIC', role: 'Technology exploitation', detail: 'Science Applications International Corporation. Named alongside Lockheed and Northrop as engaging in Technologies of Unknown Origin (TUO) retrieval and exploitation programs.' },
          ],
        },
      ],
      facilities: [
        { name: 'Area 51 / S4 (Papoose Mt, NV)', detail: 'Hangar doors into mountainside. Alleged reverse-engineering bays for recovered craft. Bob Lazar\'s testimony describes 9 craft in hangars.' },
        { name: 'Tonopah Test Range (NV)', detail: 'Lockheed-operated weapons testing site. Previously secret home of F-117 stealth fighter. Alleged UAP testing location.' },
        { name: 'Wright-Patterson AFB (OH)', detail: 'Historical materials storage. Long-rumored "Hangar 18" and Foreign Technology Division connection to recovered materials.' },
        { name: 'Dugway Proving Ground (UT)', detail: 'Called "the new Area 51." Witness testimony of non-human craft in the Dugway Avery Region.' },
      ],
    },
  ],
  personnel: [
    { name: 'Mary Sturivant', role: 'Lockheed VP → CIA DS&T', detail: 'Moved from Lockheed Martin VP position to CIA Directorate of Science & Technology. Exemplifies the revolving door between contractor and intelligence agency.', connections: ['Lockheed Martin', 'CIA DS&T'] },
    { name: 'Doug Wolf', role: 'NRO → CIA → Office of Global Access', detail: 'Career spanning NRO and CIA. Connected to the Office of Global Access, which coordinates foreign UAP material recovery.', connections: ['NRO', 'CIA', 'Office of Global Access'] },
    { name: 'Donald Kerr', role: 'NRO Dir → CIA Deputy Dir → Los Alamos/Sandia', detail: 'Served as NRO Director, then CIA Deputy Director, with connections to both Los Alamos and Sandia national laboratories. Bridges all three layers.', connections: ['NRO', 'CIA', 'Los Alamos', 'Sandia'] },
    { name: 'Paul Kaminsky', role: 'OUSD A&S → NRO, structured Black Budget', detail: 'Structured the Black Budget framework in the mid-1990s while at OUSD for Acquisition & Sustainment. Moved to NRO. Created the financial architecture that funds these programs.', connections: ['NRO', 'Pentagon', 'Black Budget'] },
    { name: 'Sean Kirkpatrick', role: 'AARO Chief → Oak Ridge CTO', detail: 'Led the Pentagon\'s AARO office investigating UAP. Departed Dec 2023 to become CTO at Oak Ridge National Laboratory — the same lab that analyzed materials AARO sent for examination.', connections: ['AARO', 'Oak Ridge', 'Battelle'] },
    { name: 'Dick Cheney', role: 'Alleged apex of the pyramid', detail: 'Per journalist Walter Kern and David Grusch, the former Vice President allegedly served as a "principal advocate" facilitating funding streams and heading the UAP program hierarchy for an extended period.', connections: ['DOE', 'Pentagon', 'Contractors'] },
  ],
  process: [
    { name: 'Detection', detail: 'Sentient AI flags anomalous signature in global sensor data' },
    { name: 'Tracking', detail: 'Immaculate Constellation retasks NRO satellites to characterize object' },
    { name: 'Dispatch', detail: 'DOE/OST teams deployed; CIA Office of Global Access coordinates if foreign' },
    { name: 'Recovery', detail: 'Crash site secured by unmarked operators; witnesses isolated and debriefed' },
    { name: 'Classification', detail: 'Materials classified as Restricted Data under AEA 1954; placed outside FOIA' },
    { name: 'Storage', detail: 'Materials transferred to FFRDC (Sandia) under nuclear facility protection' },
    { name: 'Exploitation', detail: 'Contractors (Lockheed/Northrop) access materials at FFRDC for reverse engineering' },
  ],
}

export default function LegacyProgramChart() {
  const [activeNode, setActiveNode] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  function handleNodeClick(node, e) {
    if (activeNode?.name === node.name) {
      setActiveNode(null)
      return
    }
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setTooltipPos({ x: Math.min(Math.max(x, 140), rect.width - 140), y })
    setActiveNode(node)
  }

  return (
    <div ref={containerRef} className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 border border-indigo-500/20 rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-indigo-400">Interactive Framework</span>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">The Legacy Program</h2>
        <p className="text-xs text-slate-500 mb-1">Based on UAP Gerb's research — click any element for details</p>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          A three-layer, compartmentalized system operating outside normal congressional oversight.
          Materials classified under the Atomic Energy Act of 1954 ensure no single oversight body audits the entire chain.
        </p>

        {/* Three Layers */}
        <div className="space-y-6">
          {CHART_DATA.layers.map((layer, i) => (
            <LayerSection
              key={i}
              layer={layer}
              index={i}
              activeNode={activeNode}
              onNodeClick={handleNodeClick}
            />
          ))}
        </div>

        {/* Personnel Network */}
        <PersonnelNetwork
          personnel={CHART_DATA.personnel}
          activeNode={activeNode}
          onNodeClick={handleNodeClick}
        />

        {/* Process Flow */}
        <ProcessFlow steps={CHART_DATA.process} />

        {/* Classification note */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">Classification Shield</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The Atomic Energy Act of 1954 classifies recovered materials as "Restricted Data" or "Transclassified Foreign Nuclear Information."
              This places them under DOE authority — outside presidential Executive Order authority, exempt from FOIA,
              and beyond any single congressional committee's oversight. NRO reports to intelligence committees,
              DOE to energy committees, and contractors operate under private governance.
            </p>
          </div>
        </div>

        {/* Sources */}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[10px] text-slate-600">Sources:</span>
          {[
            { t: 'UAP Gerb', u: 'https://www.youtube.com/@UAPGerb' },
            { t: 'Three-Layer Analysis', u: 'https://medium.com/@BandGA/9-hours-of-uap-research-condensed-the-three-layer-secrecy-system-0b5d08289019' },
            { t: 'Grusch Testimony', u: 'https://www.govinfo.gov/content/pkg/CHRG-118hhrg53022/html/CHRG-118hhrg53022.htm' },
            { t: 'AEA 1954', u: 'https://en.wikipedia.org/wiki/Atomic_Energy_Act_of_1954' },
          ].map((s, i) => (
            <a key={i} href={s.u} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400/60 hover:text-indigo-400 underline underline-offset-2">
              {s.t}
            </a>
          ))}
        </div>
      </div>

      {/* Tooltip overlay */}
      {activeNode && (
        <Tooltip
          node={activeNode}
          position={tooltipPos}
          onClose={() => setActiveNode(null)}
        />
      )}
    </div>
  )
}
