import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

/** Fallback so GitHub Pages builds work even if Actions secrets are unset. */
const FALLBACK_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyDBFoBI8mNA1jSq24uhDKdGWLvucsH9fa4',
  authDomain: 'exampulse-62f1c.firebaseapp.com',
  projectId: 'exampulse-62f1c',
  storageBucket: 'exampulse-62f1c.firebasestorage.app',
  messagingSenderId: '89705982194',
  appId: '1:89705982194:web:9120f47e097fba8e6f086b',
}

function readConfig(): FirebaseWebConfig | null {
  const cfg: FirebaseWebConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain,
    projectId:
      import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      FALLBACK_CONFIG.storageBucket,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      FALLBACK_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
  }
  const ready = Object.values(cfg).every((v) => typeof v === 'string' && v.length > 0)
  return ready ? cfg : null
}

export const firebaseConfig = readConfig()
export const isFirebaseConfigured = !!firebaseConfig

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig) return null
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp()
  if (!a) return null
  if (!auth) auth = getAuth(a)
  return auth
}

export function getFirebaseDb(): Firestore | null {
  const a = getFirebaseApp()
  if (!a) return null
  if (!db) db = getFirestore(a)
  return db
}
