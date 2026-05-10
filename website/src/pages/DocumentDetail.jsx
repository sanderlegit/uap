import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  useDocument,
  useDocuments,
  useManifest,
  useGraph,
  useResearch,
  agencyClass,
  agencyColor,
  formatDate,
} from '../hooks/useData'
import { useExplorationTrail } from '../hooks/useExplorationTrail'
import DocThumbnail from '../components/DocThumbnail'
import PageReader from '../components/PageReader'

function QuoteBlock({ quote, page, onQuoteClick }) {
  if (!quote) return null
  return (
    <button
      onClick={() => onQuoteClick({ quote, page })}
      className="mt-1.5 block w-full text-left border-l-2 border-amber-500/40 pl-3 py-1 bg-amber-500/5 rounded-r cursor-pointer hover:bg-amber-500/10 hover:border-amber-400/60 transition-colors group"
    >
      <span className="text-xs text-amber-200/70 italic leading-relaxed line-clamp-2 group-hover:text-amber-200/90">
        &ldquo;{quote}&rdquo;
      </span>
      {page != null && (
        <span className="text-[10px] text-amber-500/50 ml-2 group-hover:text-amber-400/70">p.{page} &rarr;</span>
      )}
    </button>
  )
}

const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}

const LAYER_LABELS = {
  surveillance: 'Surveillance',
  custodial: 'Custodial',
  industrial: 'Industrial',
  center: 'Core',
}

function Badge({ children, color }) {
  return (
    <span
      className="inline-block px-2.5 py-1 rounded text-[11px] font-medium"
      style={{
        backgroundColor: color ? `${color}20` : 'rgba(100,116,139,0.2)',
        color: color || '#94a3b8',
      }}
    >
      {children}
    </span>
  )
}

function Section({ title, defaultOpen = true, children, count }) {
  return (
    <details open={defaultOpen || undefined} className="group">
      <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-colors">
        <span className="text-[10px] text-slate-500 group-open:rotate-90 transition-transform">&#9654;</span>
        {title}
        {count != null && (
          <span className="text-[10px] font-normal text-slate-500">({count})</span>
        )}
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-24 mb-4" />
      <div className="h-6 bg-slate-700 rounded w-3/4 mb-3" />
      <div className="flex gap-2 mb-6">
        <div className="h-5 bg-slate-700 rounded w-12" />
        <div className="h-5 bg-slate-700 rounded w-24" />
        <div className="h-5 bg-slate-700 rounded w-20" />
      </div>
      <div className="h-24 bg-slate-800 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-800/60 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  )
}


export default function DocumentDetail() {
  const { id } = useParams()
  const numId = Number(id)
  const navigate = useNavigate()
  const doc = useDocument(numId)
  const docs = useDocuments()
  const manifest = useManifest()
  const graph = useGraph()
  const research = useResearch()

  const [narratives, setNarratives] = useState(null)
  const [legacyWeb, setLegacyWeb] = useState(null)
  const [activeQuote, setActiveQuote] = useState(null)
  const pageReaderRef = useRef(null)

  const { addToTrail } = useExplorationTrail()

  useEffect(() => {
    if (doc) {
      addToTrail({ type: 'document', id: numId, title: doc.title, path: '/documents/' + numId })
    }
  }, [doc, numId, addToTrail])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [numId])

  useEffect(() => {
    fetch('/data/doc_narratives.json')
      .then(r => r.json())
      .then(setNarratives)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/data/legacy_web.json')
      .then(r => r.json())
      .then(setLegacyWeb)
      .catch(() => {})
  }, [])

  const manifestEntry = useMemo(() => {
    if (!manifest || !doc) return null
    return manifest[doc.filename] || null
  }, [manifest, doc])

  const narrative = narratives?.[String(numId)]

  const crossRefs = useMemo(() => {
    if (!graph || !docs) return []
    const connected = graph.edges
      .filter(e => e.source_id === numId || e.target_id === numId)
      .map(e => ({
        id: e.source_id === numId ? e.target_id : e.source_id,
        weight: e.weight,
        edge_type: e.edge_type,
      }))
      .sort((a, b) => b.weight - a.weight)

    return connected.map(c => {
      const refDoc = docs.find(d => d.id === c.id)
      return refDoc ? { ...c, title: refDoc.title, agency: refDoc.agency } : null
    }).filter(Boolean)
  }, [graph, docs, numId])

  const legacyConnections = useMemo(() => {
    if (!legacyWeb) return []
    const docNodeId = `doc_${numId}`
    const nodeMap = new Map(legacyWeb.nodes.map(n => [n.id, n]))
    return legacyWeb.edges
      .filter(e => e.source === docNodeId && e.type === 'document')
      .map(e => {
        const node = nodeMap.get(e.target)
        if (!node) return null
        return {
          nodeId: node.id,
          label: node.label,
          layer: node.layer,
          color: node.color,
          description: node.description,
          weight: e.weight,
          reasons: (e.reason || '').split(';').map(r => r.trim()).filter(Boolean),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
  }, [legacyWeb, numId])

  const researchContext = useMemo(() => {
    if (!research || !doc) return []
    const fname = (doc.filename || '').replace('.pdf', '').toLowerCase()
    return (research.correlations || []).filter(c =>
      c.related_docs?.some(rd => {
        const rdLower = rd.toLowerCase()
        return fname && (fname.includes(rdLower) || rdLower.includes(fname))
      })
    )
  }, [research, doc])

  const handleQuoteClick = useCallback(({ quote, page }) => {
    setActiveQuote({ quote, page })
    if (pageReaderRef.current) {
      pageReaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const prevId = numId > 0 ? numId - 1 : null
  const nextId = docs && numId < docs.length - 1 ? numId + 1 : null

  const pages = useMemo(() => {
    if (!doc?.full_text) return []
    return doc.full_text.split('--- PAGE BREAK ---')
  }, [doc])

  if (!doc) return <LoadingSkeleton />

  const acls = agencyClass(doc.agency)
  const acol = agencyColor(doc.agency)

  const hasSensors = doc.sensors?.length > 0
  const hasBehaviors = doc.behaviors?.length > 0
  const hasShapes = doc.shapes?.length > 0
  const hasWitnesses = doc.witnesses?.length > 0
  const hasEntities = doc.entities?.length > 0
  const hasRedaction = doc.has_redaction === 1
  const hasCrossRefs = crossRefs.length > 0 || doc.cross_refs?.length > 0
  const hasMetadata = hasSensors || hasBehaviors || hasShapes || hasWitnesses || hasEntities

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* ── Document Header ────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mb-3 leading-snug">{doc.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="agency-badge text-sm px-3 py-1"
            style={{
              backgroundColor: `${acol}20`,
              color: acol,
            }}
          >
            {AGENCY_SHORT[doc.agency] || doc.agency}
          </span>
          {doc.incident_date_parsed && (
            <span className="text-sm text-slate-400">{formatDate(doc.incident_date_parsed)}</span>
          )}
          {doc.incident_location && doc.incident_location !== 'N/A' && (
            <span className="text-sm text-slate-500">{doc.incident_location}</span>
          )}
          <span className="text-xs text-slate-500 bg-slate-800 rounded px-2.5 py-1">
            {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}
          </span>
          {hasRedaction && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 rounded px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Redacted
            </span>
          )}
        </div>
      </div>

      {/* ── Explore This Document In ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
        <span className="text-slate-500">Explore in:</span>
        {doc.incident_date_parsed && (
          <Link to={`/timeline?doc=${doc.id}${doc.decade ? `&decade=${doc.decade}` : ''}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Timeline
          </Link>
        )}
        <Link to={`/graph?node=${doc.id}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
          Network Graph
        </Link>
        {doc.incident_location && doc.incident_location !== 'N/A' && (
          <Link to={`/map?${doc.latitude != null && doc.longitude != null ? `lat=${doc.latitude}&lng=${doc.longitude}&zoom=10&` : ''}doc=${doc.id}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Map
          </Link>
        )}
        <Link to={`/search?q=${encodeURIComponent(doc.title.split(',')[0].trim())}`} className="px-3 py-1.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
          Search
        </Link>
      </div>

      {/* ── "Why This Matters" ─────────────────────────────────────── */}
      {(narrative?.why_it_matters || manifestEntry?.description) && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/20 border border-blue-500/20 rounded-lg p-5 mb-6">
          <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-blue-400 mb-2">Why This Matters</h2>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {narrative?.why_it_matters || manifestEntry?.description}
          </p>
        </div>
      )}

      {/* ── Document Evidence (sensors, behaviors, shapes, witnesses) ── */}
      {(hasSensors || hasBehaviors || hasShapes || hasWitnesses) && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6 py-3 px-4 bg-slate-800/30 border border-slate-700/40 rounded-lg">
          {hasSensors && (
            <div>
              <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-blue-400/70 mb-1.5">Sensors</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.sensors.map((s, i) => (
                  <Badge key={i} color="#3b82f6">
                    {s.sensor_type}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {hasBehaviors && (
            <div>
              <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-amber-400/70 mb-1.5">Behaviors</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.behaviors.map((b, i) => (
                  <Badge key={i} color="#f59e0b">{b}</Badge>
                ))}
              </div>
            </div>
          )}
          {hasShapes && (
            <div>
              <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-purple-400/70 mb-1.5">Shapes</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.shapes.map((s, i) => (
                  <Badge key={i} color="#8b5cf6">
                    {s.shape}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {hasWitnesses && (
            <div>
              <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-emerald-400/70 mb-1.5">Witnesses</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.witnesses.map((w, i) => (
                  <Badge key={i} color="#10b981">{w}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Key Findings ───────────────────────────────────────────── */}
      {narrative?.key_findings?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Key Findings</h2>
          <div className="space-y-3">
            {narrative.key_findings.map((finding, i) => {
              const isV2 = typeof finding === 'object' && finding !== null
              const text = isV2 ? finding.finding : finding
              const quote = isV2 ? finding.quote : null
              const page = isV2 ? finding.page : null
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
                    <QuoteBlock quote={quote} page={page} onQuoteClick={handleQuoteClick} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Legacy Program Context ─────────────────────────────────── */}
      {legacyConnections.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-amber-400">Legacy Program Context</h2>
            <Link to={`/graph?node=doc_${numId}`} className="text-[11px] text-amber-500/60 hover:text-amber-400 transition-colors">
              View in graph &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {legacyConnections.map(conn => (
              <div key={conn.nodeId} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-24 mt-1.5">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${conn.weight * 100}%`, backgroundColor: conn.color }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 text-right font-mono">{conn.weight.toFixed(2)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{conn.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${conn.color}15`, color: conn.color }}>
                      {LAYER_LABELS[conn.layer] || conn.layer}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {conn.reasons.map((r, i) => (
                      <p key={i} className="text-xs text-slate-400 leading-relaxed">
                        {r}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Page-by-Page Document Reader ─────────────────────────────── */}
      <div ref={pageReaderRef}>
        {doc.total_pages > 0 && (
          <PageReader
            docId={numId}
            pageCount={doc.total_pages}
            pages={pages}
            redactedPages={doc.redaction?.flatMap(r => {
              const count = r.redacted_pages || 0
              return count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : []
            })}
            originalUrl={manifestEntry?.url}
            activeQuote={activeQuote}
            onClearQuote={() => setActiveQuote(null)}
          />
        )}
      </div>

      {/* ── Official Description ───────────────────────────────────── */}
      {manifestEntry?.description && (
        <div className="mb-4">
          <Section title="Official Pentagon Description" defaultOpen={false}>
            <p className="text-sm text-slate-400 leading-relaxed">{manifestEntry.description}</p>
          </Section>
        </div>
      )}

      {/* ── Entities Mentioned ─────────────────────────────────────── */}
      {hasEntities && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          <Section title="Entities Mentioned" count={doc.entities.length} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {doc.entities.map((e, i) => (
                <Link key={i} to={`/entities?q=${encodeURIComponent(e.entity_value)}`} className="hover:brightness-125 transition-all">
                  <Badge color={e.entity_type === 'organization' ? '#3b82f6' : e.entity_type === 'person' ? '#ec4899' : '#6b7280'}>
                    <span className="opacity-60 mr-1">{e.entity_type}:</span>{e.entity_value}
                  </Badge>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Redaction Info ──────────────────────────────────────────── */}
      {hasRedaction && doc.redaction?.length > 0 && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 mb-4">
          <Section title="Redaction Details" defaultOpen>
            <div className="space-y-1.5">
              {doc.redaction.map((r, i) => (
                <div key={i} className="text-sm text-red-300/80">
                  <span className="text-red-400 font-medium">{r.redacted_pages}</span> page{r.redacted_pages !== 1 ? 's' : ''} with redactions
                  {r.black_rect_count > 0 && (
                    <span className="text-red-400/60 ml-2">
                      ({r.black_rect_count} black rectangle{r.black_rect_count !== 1 ? 's' : ''}, {(r.black_area_pct * 100).toFixed(1)}% area)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Related Documents ──────────────────────────────────────── */}
      {hasCrossRefs && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          <Section title="Related Documents" count={crossRefs.length} defaultOpen>
            <div className="space-y-1.5">
              {crossRefs.slice(0, 8).map(ref => (
                <Link
                  key={ref.id}
                  to={`/documents/${ref.id}`}
                  className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-slate-700/30 transition-colors group"
                >
                  <DocThumbnail docId={ref.id} size="sm" className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`agency-badge ${agencyClass(ref.agency)} shrink-0`}>
                        {AGENCY_SHORT[ref.agency] || ref.agency}
                      </span>
                      <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-1">
                        {ref.title}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {(ref.weight * 100).toFixed(0)}%
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Research Context ───────────────────────────────────────── */}
      {researchContext.length > 0 && (
        <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-4 mb-4">
          <Section title="Research Context" defaultOpen>
            <div className="space-y-3">
              {researchContext.map((rc, i) => (
                <div key={i}>
                  <h4 className="text-sm font-medium text-indigo-300 mb-1">{rc.topic}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">{rc.context}</p>
                  {rc.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {rc.sources.map((s, j) => (
                        <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}


      {/* ── Extraction info ────────────────────────────────────────── */}
      <div className="text-[11px] text-slate-500 mb-6">
        Extracted via {doc.extraction_method}{doc.ocr_applied ? ' + OCR' : ''}
        {' · '}Source: <a href="https://war.gov/UFO" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">war.gov/UFO</a>
      </div>

      {/* ── Previous / Next navigation ─────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-700/50 pt-4">
        {prevId != null ? (
          <button
            onClick={() => navigate(`/documents/${prevId}`)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-2 px-3"
          >
            <span>&larr;</span>
            <span>Previous</span>
          </button>
        ) : (
          <div />
        )}
        <Link to="/documents" className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-2 px-3">
          All documents
        </Link>
        {nextId != null ? (
          <button
            onClick={() => navigate(`/documents/${nextId}`)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-2 px-3"
          >
            <span>Next</span>
            <span>&rarr;</span>
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
