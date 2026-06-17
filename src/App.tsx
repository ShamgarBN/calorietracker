import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { Today } from './pages/Today'

// Today is the landing view (eager). The rest are code-split so the initial
// bundle stays small — Trends pulls in Recharts, Plan pulls in the generator.
const Trends = lazy(() => import('./pages/Trends').then((m) => ({ default: m.Trends })))
const Plan = lazy(() => import('./pages/Plan').then((m) => ({ default: m.Plan })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))

function RouteFallback() {
  return (
    <div className="flex justify-center py-16 text-muted">
      <Loader2 size={22} className="animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route
            path="trends"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Trends />
              </Suspense>
            }
          />
          <Route
            path="plan"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Plan />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </AuthGate>
  )
}
