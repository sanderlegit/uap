import { useState, useEffect, useRef, useCallback } from 'react'
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

export default function PageReader({ docId, pageCount, pages, redactedPages, originalUrl }) {
  const [lightboxPage, setLightboxPage] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedText, setExpandedText] = useState(new Set())
  const [imageFailed, setImageFailed] = useState(new Set())
  const pageRefs = useRef({})
  const stickyRef = useRef(null)

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

  // Deep-link to page via URL hash
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('page')
    if (p) {
      const el = pageRefs.current[p]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [])

  const toggleText = useCallback((num) => {
    setExpandedText(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }, [])

  const effectivePageCount = pageCount || pages?.length || 0
  if (effectivePageCount === 0) return null

  return (
    <div className="mb-6">
      {/* Sticky header */}
      <div ref={stickyRef} className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-700/50 py-2 px-1 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Page <span className="text-slate-200">{currentPage}</span> of {effectivePageCount}
          </span>
        </div>
        <div className="flex items-center gap-3">
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
          const textShown = expandedText.has(num)

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
                  {pageText && (
                    <button
                      onClick={() => toggleText(num)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer px-2 py-1.5"
                    >
                      {textShown ? 'hide text' : 'show text'}
                    </button>
                  )}
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

              {/* Page image */}
              {hasImage && (
                <div
                  className="cursor-zoom-in"
                  onClick={() => setLightboxPage(num)}
                >
                  <PageImage
                    docId={docId}
                    pageNum={num}
                    onError={() => setImageFailed(prev => new Set(prev).add(num))}
                  />
                </div>
              )}

              {/* Fallback: show text if image failed */}
              {!hasImage && pageText && (
                <div className="p-4 bg-slate-900">
                  <div className="doc-text text-slate-300 text-sm">{pageText}</div>
                </div>
              )}

              {/* Expandable text under image */}
              {hasImage && textShown && pageText && (
                <div className="p-4 bg-slate-900/60 border-t border-slate-700/30">
                  <div className="doc-text text-slate-400 text-xs">{pageText}</div>
                </div>
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
