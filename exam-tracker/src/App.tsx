import { useEffect } from 'react'
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'
import { useProgressHydration } from './hooks/useProgress'
import { normalizeHashRoute } from './lib/normalizeHashRoute'
import { ComparePage } from './pages/ComparePage'
import { Dashboard } from './pages/Dashboard'
import { ExamDetail } from './pages/ExamDetail'
import { FocusPage } from './pages/FocusPage'
import { PrepLab } from './pages/PrepLab'
import { RoadmapPage } from './pages/RoadmapPage'
import { TopicsPage } from './pages/TopicsPage'
import './App.css'

/** GitHub Pages project subpath needs hash routes for deep links. */
const useHashRouter = import.meta.env.BASE_URL.includes('/Projects/exam-tracker')

export default function App() {
  const ready = useProgressHydration()

  useEffect(() => {
    if (!useHashRouter) return
    // Fix #targets-style hashes that break HashRouter + cause jump-scroll
    normalizeHashRoute()
  }, [])

  if (!ready) {
    return (
      <div className="boot">
        <p>Loading ExamPulse…</p>
      </div>
    )
  }

  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined
  const Router = useHashRouter ? HashRouter : BrowserRouter

  return (
    <Router basename={useHashRouter ? undefined : basename}>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="exam/:examId" element={<ExamDetail />} />
          <Route path="topics" element={<TopicsPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="prep" element={<PrepLab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}
