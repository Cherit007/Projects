import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useProgressHydration } from './hooks/useProgress'
import { Dashboard } from './pages/Dashboard'
import { ExamDetail } from './pages/ExamDetail'
import { TopicsPage } from './pages/TopicsPage'
import './App.css'

export default function App() {
  const ready = useProgressHydration()

  if (!ready) {
    return (
      <div className="boot">
        <p>Loading ExamPulse…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="exam/:examId" element={<ExamDetail />} />
          <Route path="topics" element={<TopicsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
