import { useState, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useReport } from '../hooks/useData'

const tabs = [
  { key: 'report', label: 'Full Report' },
  { key: 'fbi', label: 'FBI Deep Dive' },
  { key: 'apollo', label: 'Apollo Deep Dive' },
  { key: 'redactions', label: 'Redaction Analysis' },
  { key: 'high_interest', label: 'High Interest Cases' },
]

const validKeys = new Set(tabs.map(t => t.key))

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 py-8">
      <div className="h-8 bg-slate-800 rounded w-3/4" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800 rounded w-5/6" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-6 bg-slate-800 rounded w-1/2 mt-6" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800 rounded w-4/5" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800 rounded w-3/4" />
      <div className="h-6 bg-slate-800 rounded w-2/3 mt-6" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800 rounded w-5/6" />
    </div>
  )
}

function TOC({ headings }) {
  const [open, setOpen] = useState(false)

  if (!headings || headings.length === 0) return null

  return (
    <div className="mb-6 border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-slate-800/80 transition-colors"
      >
        <span>Table of Contents ({headings.length} sections)</span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700/50 max-h-64 overflow-y-auto">
          <ul className="space-y-1">
            {headings.map((h, i) => (
              <li key={i}>
                <a
                  href={`#${h.slug}`}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors leading-relaxed block py-0.5"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const mdComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold text-slate-100 mb-4 mt-8" {...props}>{children}</h1>
  ),
  h2: ({ children, node, ...props }) => {
    const text = typeof children === 'string' ? children : String(children)
    const slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    return (
      <h2 id={slug} className="text-xl font-semibold text-slate-200 mb-3 mt-6 border-b border-slate-700 pb-2 scroll-mt-20" {...props}>
        {children}
      </h2>
    )
  },
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-medium text-slate-300 mb-2 mt-4" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-medium text-slate-300 mb-2 mt-3" {...props}>{children}</h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-slate-300 mb-3 leading-relaxed text-sm" {...props}>{children}</p>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4 rounded-lg border border-slate-700/50">
      <table className="w-full border-collapse" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="bg-slate-800 text-left p-2 text-xs font-semibold text-slate-300 border-b border-slate-700" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="p-2 text-xs text-slate-400 border-b border-slate-800" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, node, ...props }) => {
    // We cannot reliably get the row index from the node for striping,
    // so we use the even: modifier via a CSS class approach
    return <tr className="even:bg-slate-900/50" {...props}>{children}</tr>
  },
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-blue-500 pl-4 italic text-slate-400 my-3 text-sm" {...props}>
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }) => (
    <strong className="text-slate-200" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-slate-300" {...props}>{children}</em>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 pl-4 list-disc" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 pl-4 list-decimal" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-slate-300 text-sm mb-1" {...props}>{children}</li>
  ),
  a: ({ children, href, ...props }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  hr: (props) => (
    <hr className="border-slate-700 my-6" {...props} />
  ),
  code: ({ children, className, ...props }) => {
    // Inline code vs code blocks
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className={`block bg-slate-900 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto mb-3 ${className || ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className="bg-slate-800 text-slate-300 text-xs px-1.5 py-0.5 rounded" {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }) => (
    <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto mb-3" {...props}>{children}</pre>
  ),
}

function parseHeadings(markdown) {
  if (!markdown) return []
  const headings = []
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^## (.+)$/)
    if (match) {
      const text = match[1].replace(/[*_`]/g, '')
      const slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      headings.push({ text, slug })
    }
  }
  return headings
}

export default function Analysis() {
  const { section } = useParams()
  const safeSection = validKeys.has(section) ? section : 'report'
  const content = useReport(safeSection)
  const headings = useMemo(() => parseHeadings(content), [content])

  if (!section || !validKeys.has(section)) {
    return <Navigate to="/analysis/report" replace />
  }

  return (
    <div className="bg-slate-950 min-h-dvh pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-6 sm:pt-10">
        {/* Tab Navigation */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 mb-6">
          <div className="flex gap-1 min-w-max">
            {tabs.map(tab => (
              <Link
                key={tab.key}
                to={`/analysis/${tab.key}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  section === tab.key
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Content */}
        {content === null ? (
          <Skeleton />
        ) : (
          <>
            <TOC headings={headings} />
            <div className="min-w-0">
              <ReactMarkdown components={mdComponents}>
                {content}
              </ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
