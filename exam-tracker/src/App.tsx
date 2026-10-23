import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  RouterProvider,
  Routes,
  createHashRouter,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import { useProgressHydration } from './hooks/useProgress'
import { ComparePage } from './pages/ComparePage'
import { Dashboard } from './pages/Dashboard'
import { ExamDetail } from './pages/ExamDetail'
import { FocusPage } from './pages/FocusPage'
import { PrepLab } from './pages/PrepLab'
import { RoadmapPage } from './pages/RoadmapPage'
import { TopicsPage } from './pages/TopicsPage'
import './App.css'

const useHashRouter = import.meta.env.BASE_URL.includes('/Projects/exam-tracker')

function routes() {
  return [
    {
      Component: Layout,
      children: [
        { index: true, Component: Dashboard },
        { path: 'exam/:examId', Component: ExamDetail },
        { path: 'topics', Component: TopicsPage },
        { path: 'roadmap', Component: RoadmapPage },
        { path: 'compare', Component: ComparePage },
        { path: 'focus', Component: FocusPage },
        { path: 'prep', Component: PrepLab },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ]
}

function BrowserApp() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined
  return (
    <BrowserRouter basename={basename}>
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
    </BrowserRouter>
  )
}

function HashApp() {
  const router = useMemo(() => createHashRouter(routes()), [])
  // RR7 + React 19: data-router state/URL update on navigate, but RouterProvider
  // context consumers (Outlet, useLocation) stay on the first match. Remount the
  // provider on every committed navigation so the tree reads the new state.
  const [epoch, setEpoch] = useState(0)
  const lastLocKey = useRef(router.state.location.key)
  useEffect(() => {
    const unsub = router.subscribe((state) => {
      if (state.navigation.state !== 'idle') return
      if (state.location.key === lastLocKey.current) return
      lastLocKey.current = state.location.key
      setEpoch((n) => n + 1)
    })
    return unsub
  }, [router])

  return <RouterProvider router={router} key={epoch} />
}

export default function App() {
  const ready = useProgressHydration()
  const [hashReady, setHashReady] = useState(!useHashRouter)

  useEffect(() => {
    if (!useHashRouter) return
    // Normalize bare #anchors and empty hash → #/
    const h = window.location.hash
    if (!h || h === '#' || (h.startsWith('#') && !h.startsWith('#/'))) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#/`,
      )
    }
    setHashReady(true)
  }, [])

  if (!ready || !hashReady) {
    return (
      <div className="boot">
        <p>Loading ExamPulse…</p>
      </div>
    )
  }

  return useHashRouter ? <HashApp /> : <BrowserApp />
}
