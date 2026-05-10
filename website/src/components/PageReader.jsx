import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { pageImageUrl } from '../hooks/useData'

function PageImage({ docId, pageNum, onError }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '800px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (failed) return null

  return (
    <div ref={ref} className="bg-slate-900 rounded overflow-hidden">
      {visible ? (
        <img
          src={pageImageUrl(docId, pageNum)}
          alt={`Page ${pageNum}`}
          className="w-full h-auto"
          loading="lazy"
          onError={() => { setFailed(true); onError?.() }}
        />
      ) : (
        <div className="w-full aspect-[612/792] bg-slate-800/40 animate-pulse" />
      )}
    </div>
  )
}

function Lightbox({ docId, pageNum, totalPages, onClose, onNavigate }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && pageNum > 1) onNavigate(pageNum - 1)
      if (e.key === 'ArrowRight' && pageNum < totalPages) onNavigate(pageNum + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pageNum, totalPages, onClose, onNavigate])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <span className="text-sm text-slate-400 font-mono">Page {pageNum} of {totalPages}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer">&times;</button>
      </div>

      {pageNum > 1 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(pageNum - 1) }}
        >
          &larr;
        </button>
      )}

      {pageNum < totalPages && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(pageNum + 1) }}
        >
          &rarr;
        </button>
      )}

      <img
        src={pageImageUrl(docId, pageNum)}
        alt={`Page ${pageNum}`}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function HighlightedText({ text, quote, searchTerm }) {
  const base = <pre className="doc-text text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{text}</pre>
  const term = quote || searchTerm
  if (!term || !text) return base

  const escQ = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flexWs = escQ.replace(/\s+/g, '\\s+')
  const pattern = new RegExp(flexWs, 'gi')

  const parts = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(<mark key={match.index} className="bg-amber-500/30 text-amber-100 rounded px-0.5">{match[0]}</mark>)
    lastIndex = match.index + match[0].length
    if (!searchTerm) break
  }
  if (parts.length === 0) return base
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return (
    <pre className="doc-text text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{parts}</pre>
  )
}

const VIEW_MODES = {
  scan: { label: 'Scan', title: 'Page images only' },
  side: { label: 'Side-by-side', title: 'Image + transcript' },
  text: { label: 'Text', title: 'Transcript only' },
}

export default function PageReader({ docId, pageCount, pages, redactedPages, originalUrl, activeQuote, onClearQuote }) {
  const [lightboxPage, setLightboxPage] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [imageFailed, setImageFailed] = useState(new Set())
  const [viewMode, setViewMode] = useState('scan')
  const pageRefs = useRef({})
  const stickyRef = useRef(null)

  const hasAnyText = pages?.some(p => p?.trim())
  const redactedSet = new Set(redactedPages || [])

  useEffect(() => {
    const observers = []
    const entries = Object.entries(pageRefs.current)
    if (entries.length === 0) return

    entries.forEach(([num, el]) => {
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setCurrentPage(Number(num)) },
        { rootMargin: '-40% 0px -40% 0px' }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [pageCount])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('page')
    if (p) {
      const el = pageRefs.current[p]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [])

  const matchPages = useMemo(() => {
    if (!activeQuote?.searchTerm || !pages) return []
    const term = activeQuote.searchTerm.toLowerCase()
    return pages.reduce((acc, p, i) => {
      if (p && p.toLowerCase().includes(term)) acc.push(i + 1)
      return acc
    }, [])
  }, [activeQuote, pages])

  useEffect(() => {
    if (!activeQuote) return
    if (hasAnyText) setViewMode('side')
    const targetPage = activeQuote.page || matchPages[0]
    if (targetPage) {
      const el = pageRefs.current[targetPage]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [activeQuote, hasAnyText, matchPages])

  const effectivePageCount = pageCount || pages?.length || 0
  if (effectivePageCount === 0) return null

  return (
    <div className="mb-6">
      {/* Highlight banner */}
      {activeQuote && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            {activeQuote.searchTerm ? (
              <>
                <span className="text-xs text-amber-300 font-medium shrink-0">{activeQuote.searchTerm}</span>
                {matchPages.length > 0 && (
                  <span className="text-[10px] text-amber-500/60 shrink-0">
                    {matchPages.length} page{matchPages.length !== 1 ? 's' : ''}
                  </span>
                )}
                {matchPages.length > 1 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {matchPages.map(p => (
                      <button
                        key={p}
                        onClick={() => pageRefs.current[p]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="text-[10px] text-amber-500/50 hover:text-amber-400 cursor-pointer px-1 py-0.5 rounded hover:bg-amber-500/10"
                      >
                        p.{p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span className="text-xs text-amber-300 truncate italic">
                &ldquo;{activeQuote.quote?.slice(0, 80)}{activeQuote.quote?.length > 80 ? '...' : ''}&rdquo;
              </span>
            )}
          </div>
          <button onClick={onClearQuote} className="text-xs text-amber-500/60 hover:text-amber-400 shrink-0 cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Sticky header */}
      <div ref={stickyRef} className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-700/50 py-2 px-1 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Page <span className="text-slate-200">{currentPage}</span> of {effectivePageCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyText && (
            <div className="flex rounded-md border border-slate-700/50 overflow-hidden">
              {Object.entries(VIEW_MODES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  title={cfg.title}
                  className={`text-[11px] px-2.5 py-1 transition-colors cursor-pointer ${
                    viewMode === key
                      ? 'bg-slate-700/60 text-slate-200'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          )}
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
            >
              Original PDF ↗
            </a>
          )}
        </div>
      </div>

      {/* Pages */}
      <div className="space-y-6">
        {Array.from({ length: effectivePageCount }, (_, i) => i + 1).map(num => {
          const pageText = pages?.[num - 1]?.trim()
          const isRedacted = redactedSet.has(num)
          const hasImage = !imageFailed.has(num)
          const showImage = viewMode !== 'text' && hasImage
          const showText = viewMode !== 'scan' && pageText

          return (
            <div
              key={num}
              id={`page-${num}`}
              ref={el => { pageRefs.current[num] = el }}
              className={`rounded-lg overflow-hidden border ${
                isRedacted ? 'border-red-900/40' : 'border-slate-700/30'
              }`}
            >
              {/* Page label */}
              <div className={`flex items-center justify-between px-3 py-1.5 ${
                isRedacted ? 'bg-red-950/30' : 'bg-slate-800/40'
              }`}>
                <span className="text-[10px] font-mono text-slate-500">
                  page {num}
                  {isRedacted && <span className="text-red-400 ml-2">contains redactions</span>}
                </span>
                <div className="flex items-center gap-1">
                  {hasImage && (
                    <button
                      onClick={() => setLightboxPage(num)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer px-2 py-1.5"
                    >
                      zoom
                    </button>
                  )}
                </div>
              </div>

              {/* Content area */}
              <div className={viewMode === 'side' && showImage && showText ? 'flex' : ''}>
                {/* Image column */}
                {showImage && (
                  <div
                    className={`cursor-zoom-in ${viewMode === 'side' && showText ? 'w-1/2 flex-shrink-0' : ''}`}
                    onClick={() => setLightboxPage(num)}
                  >
                    <PageImage
                      docId={docId}
                      pageNum={num}
                      onError={() => setImageFailed(prev => new Set(prev).add(num))}
                    />
                  </div>
                )}

                {/* Text column */}
                {showText && (
                  <div className={`p-4 ${
                    viewMode === 'side'
                      ? 'w-1/2 flex-shrink-0 overflow-y-auto max-h-[80vh] border-l border-slate-700/30 bg-slate-900/40'
                      : 'bg-slate-900/60'
                  }`}>
                    <HighlightedText
                      text={pageText}
                      quote={activeQuote?.page === num ? activeQuote.quote : null}
                      searchTerm={activeQuote?.searchTerm || null}
                    />
                  </div>
                )}

                {/* Fallback: show text if image failed and we're in scan mode */}
                {!hasImage && !showText && pageText && (
                  <div className="p-4 bg-slate-900">
                    <pre className="doc-text text-slate-300 text-sm whitespace-pre-wrap font-mono">{pageText}</pre>
                  </div>
                )}
              </div>

              {/* Hidden searchable text — always in DOM for Ctrl+F even in scan mode */}
              {viewMode === 'scan' && pageText && (
                <div className="sr-only" aria-hidden="true">{pageText}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom links */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/30">
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
          >
            Open original on war.gov ↗
          </a>
        )}
      </div>

      {/* Lightbox */}
      {lightboxPage && (
        <Lightbox
          docId={docId}
          pageNum={lightboxPage}
          totalPages={effectivePageCount}
          onClose={() => setLightboxPage(null)}
          onNavigate={setLightboxPage}
        />
      )}
    </div>
  )
}
