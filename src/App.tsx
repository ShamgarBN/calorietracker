import { Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { Today } from './pages/Today'
import { Trends } from './pages/Trends'
import { Plan } from './pages/Plan'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="trends" element={<Trends />} />
          <Route path="plan" element={<Plan />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthGate>
  )
}
