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

const CATEGORY_LABELS = {
  sensor: 'Sensor Evidence',
  behavior: 'Observed Behavior',
  shape: 'Shape Description',
  witness: 'Witness Reference',
  vocab: 'Vocabulary Term',
  quote: 'Key Finding',
}

function Lightbox({ docId, pageNum, totalPages, onClose, onNavigate, activeQuote, vocabTerms, pageText, findings }) {
  const touchRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && pageNum > 1) onNavigate(pageNum - 1)
      if (e.key === 'ArrowRight' && pageNum < totalPages) onNavigate(pageNum + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pageNum, totalPages, onClose, onNavigate])

  const onTouchStart = useCallback((e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const onTouchEnd = useCallback((e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0 && pageNum > 1) onNavigate(pageNum - 1)
      else if (dx < 0 && pageNum < totalPages) onNavigate(pageNum + 1)
    }
  }, [pageNum, totalPages, onNavigate])

  const pageFindings = useMemo(() => {
    if (!findings) return []
    return findings
      .map(f => {
        if (typeof f !== 'object' || !f) return null
        const quotes = f.quotes || (f.quote ? [{ text: f.quote, page: f.page }] : [])
        const match = quotes.find(q => q.page === pageNum)
        if (!match) return null
        return { finding: f.finding, quote: match }
      })
      .filter(Boolean)
  }, [findings, pageNum])

  const pageVocab = useMemo(() => {
    if (!vocabTerms || !pageText) return []
    return vocabTerms.filter(t => {
      const re = new RegExp('\\b' + t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
      return re.test(pageText)
    })
  }, [vocabTerms, pageText])

  const searchSnippet = useMemo(() => {
    if (!activeQuote || !pageText) return null
    const term = activeQuote.searchTerm || activeQuote.quote
    if (!term) return null
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(esc, 'i')
    const m = re.exec(pageText)
    if (!m) return null
    const idx = m.index
    const len = m[0].length
    const start = Math.max(0, idx - 80)
    const end = Math.min(pageText.length, idx + len + 80)
    return {
      before: (start > 0 ? '…' : '') + pageText.slice(start, idx),
      match: pageText.slice(idx, idx + len),
      after: pageText.slice(idx + len, end) + (end < pageText.length ? '…' : ''),
    }
  }, [activeQuote, pageText])

  const hasContext = !!(pageFindings.length > 0 || searchSnippet || pageVocab.length > 0)
  const hl = activeQuote ? (HIGHLIGHT_COLORS[activeQuote.category] || DEFAULT_HIGHLIGHT) : null

  const contextPanel = hasContext ? (
    <div className="space-y-3">
      {pageFindings.length > 0 && (
        <div>
          <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-amber-400/70 mb-1.5">
            Key Findings
          </div>
          <div className="space-y-2">
            {pageFindings.map((f, i) => (
              <div key={i}>
                <p className="text-xs text-slate-300 leading-relaxed">{f.finding}</p>
                <p className="text-[11px] text-amber-200/60 italic mt-1 border-l-2 border-amber-500/30 pl-2 line-clamp-2">
                  &ldquo;{f.quote.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {searchSnippet && (
        <div>
          <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase mb-1.5"
            style={{ color: hl?.text || '#fde68a' }}>
            {CATEGORY_LABELS[activeQuote?.category] || 'Search Match'}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">
            <span>{searchSnippet.before}</span>
            <mark className="rounded px-0.5" style={{ backgroundColor: hl?.bg, color: hl?.text }}>
              {searchSnippet.match}
            </mark>
            <span>{searchSnippet.after}</span>
          </p>
        </div>
      )}
      {pageVocab.length > 0 && (
        <div>
          <div className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-teal-400/70 mb-1.5">
            Vocabulary ({pageVocab.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {pageVocab.map(t => {
              const c = VOCAB_COLORS[t.loading] || VOCAB_COLORS[1]
              return (
                <span key={t.term} className="inline-block px-2 py-0.5 rounded text-[10px]"
                  style={{ backgroundColor: c.bg, color: c.text }}
                  title={t.definition || t.category}>
                  {t.term}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="shrink-0 flex items-center justify-end gap-3 px-4 h-10 md:h-12 z-10">
        <span className="text-xs md:text-sm text-slate-400 font-mono">Page {pageNum} of {totalPages}</span>
        <button onClick={(e) => { e.stopPropagation(); onClose() }}
          className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer">&times;</button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar */}
        {hasContext && (
          <div className="hidden md:block w-72 lg:w-80 shrink-0 overflow-y-auto px-5 py-4 border-r border-slate-700/30"
            onClick={(e) => e.stopPropagation()}>
            {contextPanel}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Image — top-aligned on mobile, centered on desktop */}
          <div className="relative shrink-0 md:flex-1 flex items-start md:items-center justify-center md:px-14 md:py-4">
            {pageNum > 1 && (
              <button
                className="absolute left-1.5 md:left-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/20 md:bg-slate-800/80 md:border md:border-slate-600/50 flex items-center justify-center text-white/25 md:text-slate-300 hover:text-white hover:bg-black/40 md:hover:bg-slate-800 md:hover:border-slate-500 transition-colors cursor-pointer z-10"
                onClick={(e) => { e.stopPropagation(); onNavigate(pageNum - 1) }}
              >&larr;</button>
            )}
            {pageNum < totalPages && (
              <button
                className="absolute right-1.5 md:right-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/20 md:bg-slate-800/80 md:border md:border-slate-600/50 flex items-center justify-center text-white/25 md:text-slate-300 hover:text-white hover:bg-black/40 md:hover:bg-slate-800 md:hover:border-slate-500 transition-colors cursor-pointer z-10"
                onClick={(e) => { e.stopPropagation(); onNavigate(pageNum + 1) }}
              >&rarr;</button>
            )}
            <img
              src={pageImageUrl(docId, pageNum)}
              alt={`Page ${pageNum}`}
              className="w-full md:w-auto max-h-[60vh] md:max-h-full md:max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Mobile context — below image, scrollable */}
          {hasContext && (
            <div className="md:hidden flex-1 overflow-y-auto px-4 py-3 border-t border-slate-700/20"
              onClick={(e) => e.stopPropagation()}>
              {contextPanel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const VOCAB_COLORS = {
  1: { bg: 'rgba(34,197,94,0.18)', text: '#86efac' },
  2: { bg: 'rgba(234,179,8,0.18)', text: '#fde047' },
  3: { bg: 'rgba(249,115,22,0.18)', text: '#fdba74' },
  4: { bg: 'rgba(239,68,68,0.18)', text: '#fca5a5' },
}

const VOCAB_LABELS = { 1: 'Neutral', 2: 'Mildly loaded', 3: 'Loaded', 4: 'Shibboleth' }

const HIGHLIGHT_COLORS = {
  sensor:   { bg: 'rgba(59,130,246,0.25)', text: '#93c5fd', dark: 'rgba(23,37,84,0.95)', border: 'rgba(59,130,246,0.2)' },
  behavior: { bg: 'rgba(245,158,11,0.25)', text: '#fde68a', dark: 'rgba(69,26,3,0.95)', border: 'rgba(245,158,11,0.2)' },
  shape:    { bg: 'rgba(139,92,246,0.25)', text: '#c4b5fd', dark: 'rgba(46,16,101,0.95)', border: 'rgba(139,92,246,0.2)' },
  witness:  { bg: 'rgba(16,185,129,0.25)', text: '#6ee7b7', dark: 'rgba(6,78,59,0.95)', border: 'rgba(16,185,129,0.2)' },
  vocab:    { bg: 'rgba(20,184,166,0.25)', text: '#5eead4', dark: 'rgba(4,47,46,0.95)', border: 'rgba(20,184,166,0.2)' },
}
const DEFAULT_HIGHLIGHT = { bg: 'rgba(245,158,11,0.25)', text: '#fde68a', dark: 'rgba(69,26,3,0.95)', border: 'rgba(245,158,11,0.2)' }

function HighlightedText({ text, quote, searchTerm, searchCategory, vocabTerms }) {
  const base = <pre className="doc-text text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{text}</pre>
  if (!text) return base

  const searchActive = quote || searchTerm
  const vocabActive = vocabTerms && vocabTerms.length > 0

  if (!searchActive && !vocabActive) return base

  const highlights = []

  if (searchActive) {
    const escQ = (quote || searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flexWs = escQ.replace(/\s+/g, '\\s+')
    const boundary = searchTerm ? '\\b' : ''
    const pattern = new RegExp(boundary + flexWs + boundary, 'gi')
    let match
    while ((match = pattern.exec(text)) !== null) {
      highlights.push({ start: match.index, end: match.index + match[0].length, type: 'search' })
      if (!searchTerm) break
    }
  }

  if (vocabActive) {
    const sorted = [...vocabTerms].sort((a, b) => b.term.length - a.term.length)
    const escaped = sorted.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi')
    const termMap = {}
    sorted.forEach(t => { termMap[t.term.toLowerCase()] = t })
    let match
    while ((match = pattern.exec(text)) !== null) {
      const info = termMap[match[0].toLowerCase()]
      if (info) highlights.push({ start: match.index, end: match.index + match[0].length, type: 'vocab', info })
    }
  }

  if (highlights.length === 0) return base

  const searchHL = highlights.filter(h => h.type === 'search')
  const vocabHL = highlights.filter(h => h.type === 'vocab')
    .filter(v => !searchHL.some(s => s.start < v.end && s.end > v.start))
  const merged = [...searchHL, ...vocabHL].sort((a, b) => a.start - b.start)

  const searchColors = HIGHLIGHT_COLORS[searchCategory] || DEFAULT_HIGHLIGHT

  const parts = []
  let pos = 0
  for (const h of merged) {
    if (h.start < pos) continue
    if (h.start > pos) parts.push(text.slice(pos, h.start))
    const matched = text.slice(h.start, h.end)
    if (h.type === 'search') {
      parts.push(
        <mark key={`s${h.start}`} className="rounded px-0.5 search-highlight"
          style={{ backgroundColor: searchColors.bg, color: searchColors.text }}
        >{matched}</mark>
      )
    } else {
      const c = VOCAB_COLORS[h.info.loading] || VOCAB_COLORS[1]
      parts.push(
        <mark key={`v${h.start}`} className="rounded px-0.5 cursor-help" style={{ backgroundColor: c.bg, color: c.text }}
          title={`${h.info.term} [${VOCAB_LABELS[h.info.loading]}] — ${h.info.definition?.slice(0, 120) || h.info.category}`}
        >{matched}</mark>
      )
    }
    pos = h.end
  }
  if (pos < text.length) parts.push(text.slice(pos))

  return <pre className="doc-text text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{parts}</pre>
}

const VIEW_MODES = {
  scan: { label: 'Scan', title: 'Page images only' },
  side: { label: 'Side-by-side', title: 'Image + transcript' },
  text: { label: 'Text', title: 'Transcript only' },
}

export default function PageReader({ docId, pageCount, pages, redactedPages, originalUrl, activeQuote, onClearQuote, vocabTerms, findings }) {
  const [lightboxPage, setLightboxPage] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [imageFailed, setImageFailed] = useState(new Set())
  const hasVocab = vocabTerms && vocabTerms.length > 0
  const [viewMode, setViewMode] = useState('scan')
  const [vocabHighlight, setVocabHighlight] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const vocabInitRef = useRef(false)
  const pageRefs = useRef({})
  const stickyRef = useRef(null)
  const containerRef = useRef(null)

  const hasAnyText = pages?.some(p => p?.trim())
  const redactedSet = new Set(redactedPages || [])

  useEffect(() => {
    if (hasVocab && hasAnyText && !vocabInitRef.current) {
      vocabInitRef.current = true
      setVocabHighlight(true)
      setViewMode('side')
    }
  }, [hasVocab, hasAnyText])

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
    const escaped = activeQuote.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp('\\b' + escaped + '\\b', 'i')
    return pages.reduce((acc, p, i) => {
      if (p && pattern.test(p)) acc.push(i + 1)
      return acc
    }, [])
  }, [activeQuote, pages])

  useEffect(() => {
    if (!activeQuote) {
      setMatchCount(0)
      setMatchIdx(0)
      return
    }
    if (hasAnyText) {
      setViewMode(v => v === 'scan' ? 'side' : v)
    }
    setTimeout(() => {
      const marks = containerRef.current?.querySelectorAll('.search-highlight') || []
      setMatchCount(marks.length)
      setMatchIdx(0)
      if (marks.length > 0) {
        marks[0].classList.add('search-active')
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        const targetPage = activeQuote.page || matchPages[0]
        if (targetPage) {
          const el = pageRefs.current[targetPage]
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }, 150)
  }, [activeQuote, hasAnyText, matchPages])

  const navigateMatch = useCallback((dir) => {
    const marks = containerRef.current?.querySelectorAll('.search-highlight')
    if (!marks || marks.length === 0) return
    marks.forEach(m => m.classList.remove('search-active'))
    const next = (matchIdx + dir + marks.length) % marks.length
    setMatchIdx(next)
    marks[next].classList.add('search-active')
    marks[next].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [matchIdx])

  const effectivePageCount = pageCount || pages?.length || 0
  if (effectivePageCount === 0) return null

  const activeHL = activeQuote ? (HIGHLIGHT_COLORS[activeQuote.category] || DEFAULT_HIGHLIGHT) : null

  return (
    <div ref={containerRef} className="mb-6">
      {/* Search match nav bar */}
      {activeQuote && activeHL && (
        <div className="md:sticky md:top-0 z-30 backdrop-blur-sm px-3 py-2 mb-2 flex items-center gap-3"
          style={{ backgroundColor: activeHL.dark, borderBottom: `1px solid ${activeHL.border}` }}>
          <span className="text-xs font-medium shrink-0 truncate max-w-[200px]" style={{ color: activeHL.text }}>
            {activeQuote.searchTerm || (activeQuote.quote ? `"${activeQuote.quote.slice(0, 40)}${activeQuote.quote.length > 40 ? '...' : ''}"` : '')}
          </span>
          {matchCount > 0 && (
            <>
              <span className="text-[11px] font-mono shrink-0" style={{ color: `${activeHL.text}99` }}>
                {matchIdx + 1}/{matchCount}
              </span>
              <button
                onClick={() => navigateMatch(-1)}
                className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer text-sm"
                style={{ backgroundColor: activeHL.bg, border: `1px solid ${activeHL.border}`, color: activeHL.text }}
                title="Previous match"
              >&uarr;</button>
              <button
                onClick={() => navigateMatch(1)}
                className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer text-sm"
                style={{ backgroundColor: activeHL.bg, border: `1px solid ${activeHL.border}`, color: activeHL.text }}
                title="Next match"
              >&darr;</button>
            </>
          )}
          {matchCount === 0 && activeQuote.searchTerm && (
            <span className="text-[11px]" style={{ color: `${activeHL.text}66` }}>no matches in text</span>
          )}
          <button onClick={onClearQuote} className="ml-auto text-xs shrink-0 cursor-pointer" style={{ color: `${activeHL.text}88` }}>&times;</button>
        </div>
      )}

      {/* Sticky header */}
      <div ref={stickyRef} className="md:sticky md:top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-700/50 py-2 px-1 mb-4 flex items-center justify-between">
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
          {vocabTerms && vocabTerms.length > 0 && hasAnyText && (
            <button
              onClick={() => {
                setVocabHighlight(v => !v)
                if (viewMode === 'scan') setViewMode('side')
              }}
              title="Highlight loaded vocabulary terms"
              className={`text-[11px] px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                vocabHighlight
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                  : 'text-slate-500 hover:text-slate-300 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              Vocab
            </button>
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
                      searchCategory={activeQuote?.category || null}
                      vocabTerms={vocabHighlight ? vocabTerms : null}
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
          activeQuote={activeQuote}
          vocabTerms={vocabTerms}
          pageText={pages?.[lightboxPage - 1]?.trim()}
          findings={findings}
        />
      )}
    </div>
  )
}
