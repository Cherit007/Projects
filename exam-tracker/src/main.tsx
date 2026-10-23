import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext'
import { releaseParentServiceWorker } from './lib/releaseParentSw'
import './index.css'
import App from './App.tsx'

void releaseParentServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
