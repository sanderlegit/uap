import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import { ExplorationTrailProvider } from './hooks/useExplorationTrail'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Documents = lazy(() => import('./pages/Documents'))
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'))
const MapView = lazy(() => import('./pages/MapView'))
const Timeline = lazy(() => import('./pages/Timeline'))
const Graph = lazy(() => import('./pages/LegacyWeb'))
const Search = lazy(() => import('./pages/Search'))
const Analysis = lazy(() => import('./pages/Analysis'))
const DisclosureIndex = lazy(() => import('./pages/DisclosureIndex'))
const Theories = lazy(() => import('./pages/Theories'))
const Cases = lazy(() => import('./pages/Cases'))
const International = lazy(() => import('./pages/International'))
const Entities = lazy(() => import('./pages/Entities'))
const Pulse = lazy(() => import('./pages/Pulse'))
const Vocabulary = lazy(() => import('./pages/Vocabulary'))

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ExplorationTrailProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="graph" element={<Graph />} />
              <Route path="web" element={<Navigate to="/graph" replace />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:id" element={<DocumentDetail />} />
              <Route path="map" element={<MapView />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="search" element={<Search />} />
              <Route path="analysis/:section" element={<Analysis />} />
              <Route path="disclosure" element={<DisclosureIndex />} />
              <Route path="theories" element={<Theories />} />
              <Route path="cases" element={<Cases />} />
              <Route path="entities" element={<Entities />} />
              <Route path="international" element={<International />} />
              <Route path="pulse" element={<Pulse />} />
              <Route path="vocabulary" element={<Vocabulary />} />
            </Route>
          </Routes>
        </Suspense>
      </ExplorationTrailProvider>
    </HashRouter>
  </React.StrictMode>
)
