import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useChat } from '../hooks/useChat'

const routeContextMap = {
  '/': 'viewing the Dashboard',
  '/documents': 'browsing Documents',
  '/map': 'viewing the Map',
  '/timeline': 'viewing the Timeline',
  '/graph': 'viewing the Network Graph',
  '/search': 'using Search',
  '/disclosure': 'viewing the Disclosure Index',
  '/theories': 'browsing Theories',
  '/cases': 'browsing Cases',
  '/entities': 'browsing Entities',
  '/international': 'viewing International programs',
  '/pulse': 'viewing Pulse',
}

function getPageContext(pathname) {
  const docMatch = pathname.match(/^\/documents\/(\d+)$/)
  if (docMatch) return `viewing Document #${docMatch[1]}`

  const analysisMatch = pathname.match(/^\/analysis\/(.+)$/)
  if (analysisMatch) return `reading the ${analysisMatch[1]} analysis report`

  return routeContextMap[pathname] || null
}

function DocumentLink({ children, docId }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/documents/${docId}`)}
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
    >
      {children}
    </button>
  )
}

function MessageContent({ content }) {
  const parts = useMemo(() => {
    const docPattern = /Document #(\d+)/g
    const segments = []
    let lastIndex = 0
    let match

    while ((match = docPattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
      }
      segments.push({ type: 'docLink', value: match[0], docId: match[1] })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      segments.push({ type: 'text', value: content.slice(lastIndex) })
    }

    return segments
  }, [content])

  if (parts.length === 1 && parts[0].type === 'text') {
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
          em: ({ children }) => <em className="text-slate-300">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            if (className) {
              return <pre className="bg-slate-950 rounded p-2 text-xs overflow-x-auto mb-2"><code>{children}</code></pre>
            }
            return <code className="bg-slate-950 px-1 py-0.5 rounded text-xs text-amber-300">{children}</code>
          },
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
          h1: ({ children }) => <h3 className="text-sm font-semibold text-slate-100 mb-1 mt-2">{children}</h3>,
          h2: ({ children }) => <h3 className="text-sm font-semibold text-slate-100 mb-1 mt-2">{children}</h3>,
          h3: ({ children }) => <h4 className="text-xs font-semibold text-slate-200 mb-1 mt-2">{children}</h4>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-600 pl-3 text-slate-400 italic mb-2">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.type === 'docLink' ? (
          <DocumentLink key={i} docId={part.docId}>{part.value}</DocumentLink>
        ) : (
          <ReactMarkdown
            key={i}
            components={{
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
              em: ({ children }) => <em className="text-slate-300">{children}</em>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
            }}
          >
            {part.value}
          </ReactMarkdown>
        )
      )}
    </span>
  )
}

function ToolCallCard({ toolCall }) {
  const [expanded, setExpanded] = useState(false)

  const label = toolCall.tool === 'search_documents'
    ? 'Searching documents...'
    : toolCall.tool === 'get_document'
    ? 'Reading document...'
    : `Using ${toolCall.tool}...`

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{toolCall.summary || label}</span>
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && toolCall.input && (
        <div className="mt-1 ml-5.5 p-2 bg-slate-950 rounded text-xs text-slate-400 font-mono">
          {JSON.stringify(toolCall.input, null, 2)}
        </div>
      )}
    </div>
  )
}

function parseSuggestions(content) {
  if (!content) return []
  const lines = content.trim().split('\n')
  const suggestions = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/^\d+\.\s+(.+\?)\s*$/)
    if (match) {
      suggestions.unshift(match[1])
    } else if (suggestions.length > 0) {
      break
    }
  }
  return suggestions.length >= 2 ? suggestions : []
}

function SuggestionChips({ suggestions, onSelect, disabled }) {
  if (!suggestions.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="text-xs px-2.5 py-1 rounded-full border border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {s}
        </button>
      ))}
    </div>
  )
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const location = useLocation()
  const { messages, isStreaming, sendMessage, clearHistory } = useChat()

  const pageContext = useMemo(() => getPageContext(location.pathname), [location.pathname])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  function handleSend(text) {
    const msg = text || input
    if (!msg.trim() || isStreaming) return
    sendMessage(msg.trim(), pageContext)
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSuggestion(text) {
    handleSend(text)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-20 md:bottom-6 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 flex items-center justify-center transition-all duration-200 cursor-pointer ${open ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open chat"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-50 lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[400px] flex flex-col bg-slate-900 border-l border-slate-700/50 shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">PURSUE Research Assistant</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={clearHistory}
              className="p-2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Clear conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">Ask questions about UAP documents, cases, entities, or patterns in the data.</p>
              {pageContext && (
                <p className="text-xs text-slate-500">Currently {pageContext}</p>
              )}
            </div>
          )}

          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1
            const suggestions = msg.role === 'assistant' && !isStreaming ? parseSuggestions(msg.content) : []

            return msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-blue-600 text-sm text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[95%] w-full">
                  {msg.toolCalls.map((tc, i) => (
                    <ToolCallCard key={i} toolCall={tc} />
                  ))}
                  {msg.content && (
                    <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-slate-800 text-sm text-slate-200">
                      <MessageContent content={msg.content} />
                      {isStreaming && isLast && (
                        <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                      )}
                    </div>
                  )}
                  {!msg.content && isStreaming && isLast && (
                    <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-slate-800">
                      <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse rounded-sm" />
                    </div>
                  )}
                  <SuggestionChips suggestions={suggestions} onSelect={handleSuggestion} disabled={isStreaming} />
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-800 px-3 py-3 flex-shrink-0">
          {pageContext && messages.length > 0 && (
            <div className="text-[10px] text-slate-600 mb-1.5 px-1 truncate">Context: {pageContext}</div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the documents..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 max-h-24"
            />
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
