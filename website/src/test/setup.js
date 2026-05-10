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

class IntersectionObserverStub {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverStub
