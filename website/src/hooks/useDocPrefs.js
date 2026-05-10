import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY_READ = 'uap-read-docs'
const STORAGE_KEY_STARRED = 'uap-starred-docs'

const SUGGESTED_IDS = new Set([103, 55, 112, 0, 111, 64, 106, 75])

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

const listeners = new Set()
function broadcast() {
  listeners.forEach(fn => fn())
}

export default function useDocPrefs() {
  const [readIds, setReadIds] = useState(() => loadSet(STORAGE_KEY_READ))
  const [starredIds, setStarredIds] = useState(() => loadSet(STORAGE_KEY_STARRED))

  useEffect(() => {
    const sync = () => {
      setReadIds(loadSet(STORAGE_KEY_READ))
      setStarredIds(loadSet(STORAGE_KEY_STARRED))
    }
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])

  const markRead = useCallback((id) => {
    const numId = Number(id)
    setReadIds(prev => {
      if (prev.has(numId)) return prev
      const next = new Set(prev)
      next.add(numId)
      saveSet(STORAGE_KEY_READ, next)
      broadcast()
      return next
    })
  }, [])

  const toggleStar = useCallback((id) => {
    const numId = Number(id)
    setStarredIds(prev => {
      const next = new Set(prev)
      if (next.has(numId)) next.delete(numId)
      else next.add(numId)
      saveSet(STORAGE_KEY_STARRED, next)
      broadcast()
      return next
    })
  }, [])

  const isRead = useCallback((id) => readIds.has(Number(id)), [readIds])
  const isStarred = useCallback((id) => starredIds.has(Number(id)), [starredIds])
  const isSuggested = useCallback((id) => SUGGESTED_IDS.has(Number(id)), [])

  return { isRead, isStarred, isSuggested, markRead, toggleStar, readIds, starredIds, suggestedIds: SUGGESTED_IDS }
}
