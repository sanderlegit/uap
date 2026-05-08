import { useState, useEffect, useRef, useMemo } from 'react'

const cache = new Map()

async function fetchJSON(path) {
  if (cache.has(path)) return cache.get(path)
  const res = await fetch(path)
  const data = await res.json()
  cache.set(path, data)
  return data
}

export function useDocuments() {
  const [docs, setDocs] = useState(null)
  useEffect(() => { fetchJSON('/data/documents.json').then(setDocs) }, [])
  return docs
}

export function useDocument(id) {
  const [doc, setDoc] = useState(null)
  useEffect(() => {
    if (id == null) return
    fetchJSON(`/data/doc_${id}.json`).then(setDoc)
  }, [id])
  return doc
}

export function useGraph() {
  const [graph, setGraph] = useState(null)
  useEffect(() => { fetchJSON('/data/graph.json').then(setGraph) }, [])
  return graph
}

export function useStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => { fetchJSON('/data/stats.json').then(setStats) }, [])
  return stats
}

export function useManifest() {
  const [manifest, setManifest] = useState(null)
  useEffect(() => { fetchJSON('/data/manifest.json').then(setManifest) }, [])
  return manifest
}

export function useReport(key) {
  const [content, setContent] = useState(null)
  useEffect(() => {
    fetchJSON(`/data/${key}.json`).then(d => setContent(d.content))
  }, [key])
  return content
}

export function useSearch() {
  const indexRef = useRef(null)
  const docsRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    import('flexsearch').then(async (mod) => {
      const FlexSearch = mod.default || mod
      const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
      const searchDocs = await fetchJSON('/data/search_index.json')
      docsRef.current = searchDocs
      searchDocs.forEach(doc => {
        index.add(doc.id, `${doc.title} ${doc.agency} ${doc.location} ${doc.text}`)
      })
      indexRef.current = index
      setReady(true)
    })
  }, [])

  return useMemo(() => ({
    ready,
    search: (query, limit = 20) => {
      if (!indexRef.current || !query) return []
      const ids = indexRef.current.search(query, limit)
      return ids.map(id => docsRef.current.find(d => d.id === id)).filter(Boolean)
    }
  }), [ready])
}

export function useResearch() {
  const [data, setData] = useState(null)
  useEffect(() => { fetchJSON('/data/research.json').then(setData) }, [])
  return data
}

export function agencyClass(agency) {
  if (!agency) return 'agency-dow'
  const lower = agency.toLowerCase()
  if (lower.includes('fbi')) return 'agency-fbi'
  if (lower.includes('nasa')) return 'agency-nasa'
  if (lower.includes('state')) return 'agency-dos'
  return 'agency-dow'
}

export function agencyColor(agency) {
  if (!agency) return '#3b82f6'
  const lower = agency.toLowerCase()
  if (lower.includes('fbi')) return '#ef4444'
  if (lower.includes('nasa')) return '#8b5cf6'
  if (lower.includes('state')) return '#10b981'
  return '#3b82f6'
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}
