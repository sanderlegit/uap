import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'exploration-trail'
const MAX_ITEMS = 15

const ExplorationTrailContext = createContext(null)

function loadTrail() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveTrail(trail) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail))
  } catch {}
}

export function ExplorationTrailProvider({ children }) {
  const [trail, setTrail] = useState(loadTrail)

  useEffect(() => {
    saveTrail(trail)
  }, [trail])

  const addToTrail = useCallback(({ type, id, title, path }) => {
    setTrail(prev => {
      const key = `${type}:${id}`
      const filtered = prev.filter(item => `${item.type}:${item.id}` !== key)
      const next = [{ type, id, title, path, timestamp: Date.now() }, ...filtered]
      return next.slice(0, MAX_ITEMS)
    })
  }, [])

  const clearTrail = useCallback(() => {
    setTrail([])
  }, [])

  return (
    <ExplorationTrailContext.Provider value={{ trail, addToTrail, clearTrail }}>
      {children}
    </ExplorationTrailContext.Provider>
  )
}

export function useExplorationTrail() {
  return useContext(ExplorationTrailContext)
}
