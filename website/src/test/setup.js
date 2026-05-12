import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Default fetch mock — returns safe defaults for JSON fetches
globalThis.fetch = vi.fn((url) => {
  if (typeof url === 'string' && url.includes('legacy_web')) {
    return Promise.resolve({ json: () => Promise.resolve({ nodes: [], edges: [] }) })
  }
  return Promise.resolve({ json: () => Promise.resolve({}) })
})

// Stub browser APIs not in jsdom
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}

const localStorageStore = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => localStorageStore.has(key) ? localStorageStore.get(key) : null,
    setItem: (key, value) => localStorageStore.set(key, String(value)),
    removeItem: (key) => localStorageStore.delete(key),
    clear: () => localStorageStore.clear(),
  },
})

window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}))

class IntersectionObserverStub {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverStub
