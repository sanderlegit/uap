import { useEffect, useMemo, useState } from 'react'
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

const AGENCY_SHORT = {
  'Department of War': 'DoW',
  FBI: 'FBI',
  NASA: 'NASA',
  'Department of State': 'DoS',
}

function Badge({ children, color }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
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

  const [textExpanded, setTextExpanded] = useState(false)

  // Scroll to top when id changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [numId])

  // Manifest entry for this document
  const manifestEntry = useMemo(() => {
    if (!manifest || !doc) return null
    return manifest[doc.filename] || null
  }, [manifest, doc])

  // Cross-referenced documents via graph edges
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

  // Previous / Next navigation
  const prevId = numId > 0 ? numId - 1 : null
  const nextId = docs && numId < docs.length - 1 ? numId + 1 : null

  // Split full text into pages
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
      {/* Back link */}
      <Link to="/documents" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
        &larr; All documents
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-100 mb-3 leading-snug">{doc.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`agency-badge ${acls}`}>
            {AGENCY_SHORT[doc.agency] || doc.agency}
          </span>
          <span className="text-sm text-slate-400">{formatDate(doc.incident_date_parsed)}</span>
          {doc.incident_location && (
            <span className="text-sm text-slate-500">{doc.incident_location}</span>
          )}
          <span className="text-xs text-slate-500">
            {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}
          </span>
          <span className="text-xs text-slate-500">{doc.text_length?.toLocaleString()} chars</span>
          {hasRedaction && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Redacted
            </span>
          )}
          {doc.ocr_applied === 1 && (
            <span className="text-xs text-amber-500">OCR extracted</span>
          )}
        </div>
      </div>

      {/* Official Description (from manifest) */}
      {manifestEntry?.description && (
        <Section title="Official Description" defaultOpen>
          <p className="text-sm text-slate-300 leading-relaxed">{manifestEntry.description}</p>
        </Section>
      )}

      {/* Metadata Panel */}
      {hasMetadata && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          {hasSensors && (
            <Section title="Sensors" count={doc.sensors.length} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {doc.sensors.map((s, i) => (
                  <Badge key={i} color="#3b82f6">
                    {s.sensor_type}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
          {hasBehaviors && (
            <Section title="Observed Behaviors" count={doc.behaviors.length} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {doc.behaviors.map((b, i) => (
                  <Badge key={i} color="#f59e0b">{b}</Badge>
                ))}
              </div>
            </Section>
          )}
          {hasShapes && (
            <Section title="Reported Shapes" count={doc.shapes.length} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {doc.shapes.map((s, i) => (
                  <Badge key={i} color="#8b5cf6">
                    {s.shape}{s.mention_count > 1 ? ` (${s.mention_count})` : ''}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
          {hasWitnesses && (
            <Section title="Witnesses" count={doc.witnesses.length} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {doc.witnesses.map((w, i) => (
                  <Badge key={i} color="#10b981">{w}</Badge>
                ))}
              </div>
            </Section>
          )}
          {hasEntities && (
            <Section title="Entities Mentioned" count={doc.entities.length} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {doc.entities.map((e, i) => (
                  <Badge key={i} color={e.entity_type === 'organization' ? '#3b82f6' : e.entity_type === 'person' ? '#ec4899' : '#6b7280'}>
                    <span className="opacity-60 mr-1">{e.entity_type}:</span>{e.entity_value}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Redaction Info */}
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

      {/* Document Text */}
      {pages.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-300">Document Text</h2>
            {pages.length > 3 && (
              <button
                onClick={() => setTextExpanded(!textExpanded)}
                className="text-xs text-primary hover:text-primary-light transition-colors"
              >
                {textExpanded ? 'Collapse' : `Show all ${pages.length} pages`}
              </button>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="p-4 max-h-[80vh] overflow-y-auto" style={!textExpanded && pages.length > 3 ? { maxHeight: '60vh' } : { maxHeight: 'none' }}>
              {pages.map((page, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="page-break" />
                  )}
                  <div className="relative">
                    <span className="absolute -left-0 top-0 text-[10px] text-slate-500 select-none font-mono">
                      p.{i + 1}
                    </span>
                    <div className="doc-text pl-6 text-slate-300">{page.trim()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cross-references */}
      {hasCrossRefs && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 mb-4">
          <Section title="Related Documents" count={crossRefs.length} defaultOpen>
            <div className="space-y-1.5">
              {crossRefs.map(ref => (
                <Link
                  key={ref.id}
                  to={`/documents/${ref.id}`}
                  className="flex items-start gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-slate-700/30 transition-colors group"
                >
                  <span className={`agency-badge ${agencyClass(ref.agency)} mt-0.5 shrink-0`}>
                    {AGENCY_SHORT[ref.agency] || ref.agency}
                  </span>
                  <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-1">
                    {ref.title}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-500 shrink-0 mt-0.5">
                    {(ref.weight * 100).toFixed(0)}% match
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Research Context */}
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

      {/* External link */}
      {manifestEntry?.url && (
        <div className="mb-6">
          <a
            href={manifestEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-light transition-colors"
          >
            View original PDF on war.gov
            <span className="text-xs opacity-60">&nearr;</span>
          </a>
        </div>
      )}

      {/* Extraction info */}
      <div className="text-[11px] text-slate-500 mb-6">
        Extracted via {doc.extraction_method}{doc.ocr_applied ? ' + OCR' : ''}
      </div>

      {/* Previous / Next navigation */}
      <div className="flex items-center justify-between border-t border-slate-700/50 pt-4">
        {prevId != null ? (
          <button
            onClick={() => navigate(`/documents/${prevId}`)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>&larr;</span>
            <span>Previous</span>
          </button>
        ) : (
          <div />
        )}
        <Link to="/documents" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          All documents
        </Link>
        {nextId != null ? (
          <button
            onClick={() => navigate(`/documents/${nextId}`)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
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
