import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext'
import { normalizeHashRoute } from './lib/normalizeHashRoute'
import { releaseParentServiceWorker } from './lib/releaseParentSw'
import './index.css'
import App from './App.tsx'

void releaseParentServiceWorker()

// Run before React mounts so HashRouter never sees bare #anchor hashes
if (import.meta.env.BASE_URL.includes('/Projects/exam-tracker')) {
  normalizeHashRoute()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
