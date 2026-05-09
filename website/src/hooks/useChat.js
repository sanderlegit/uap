import { useState, useCallback, useRef } from 'react'

let nextId = 1

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const sessionIdRef = useRef(null)
  const abortRef = useRef(null)

  const sendMessage = useCallback(async (text, pageContext) => {
    if (!text.trim()) return

    const userMsg = {
      id: nextId++,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    const assistantId = nextId++
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, assistantMsg])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body = { message: text.trim() }
      if (sessionIdRef.current) body.sessionId = sessionIdRef.current
      if (pageContext) body.pageContext = pageContext

      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status}`
        try {
          const errBody = await response.json()
          if (errBody.error) errorMsg = errBody.error
        } catch {}
        throw new Error(errorMsg)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let pendingToolCall = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let data
          try {
            data = JSON.parse(raw)
          } catch {
            continue
          }

          if (data.type === 'session') {
            sessionIdRef.current = data.sessionId
          } else if (data.type === 'text') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.content }
                  : m
              )
            )
          } else if (data.type === 'tool_call') {
            pendingToolCall = { tool: data.tool, input: data.input, summary: null }
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...m.toolCalls, pendingToolCall] }
                  : m
              )
            )
          } else if (data.type === 'tool_result') {
            if (pendingToolCall) {
              pendingToolCall.summary = data.summary
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: m.toolCalls.map((tc, i) =>
                          i === m.toolCalls.length - 1
                            ? { ...tc, summary: data.summary }
                            : tc
                        ),
                      }
                    : m
                )
              )
              pendingToolCall = null
            }
          } else if (data.type === 'done') {
            setIsStreaming(false)
          } else if (data.type === 'error') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + `\n\n*Error: ${data.error}*` }
                  : m
              )
            )
            setIsStreaming(false)
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: m.content || `*Connection error: ${err.message}*` }
              : m
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [])

  const clearHistory = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setIsStreaming(false)
    sessionIdRef.current = null
  }, [])

  return { messages, isStreaming, sendMessage, clearHistory }
}
