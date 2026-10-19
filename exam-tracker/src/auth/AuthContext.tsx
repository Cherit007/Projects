import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  flushCloudSave,
  getCloudUser,
  mergeAppState,
  pullCloudState,
  setCloudUser,
} from '../lib/cloudSync'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import {
  exportProgressSnapshot,
  replaceProgressState,
  type AppState,
} from '../hooks/useProgress'

type AuthContextValue = {
  configured: boolean
  user: User | null
  loading: boolean
  syncing: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, (next) => {
      void (async () => {
        setUser(next)
        setError(null)
        if (!next) {
          setCloudUser(null)
          setLoading(false)
          return
        }

        setSyncing(true)
        try {
          setCloudUser(next.uid)
          const cloud = await pullCloudState(next.uid)
          const local = exportProgressSnapshot()
          const merged: AppState = cloud ? mergeAppState(local, cloud) : local
          replaceProgressState(merged)
          await flushCloudSave(merged, {
            email: next.email,
            displayName: next.displayName,
          })
        } catch (e) {
          console.warn(e)
          setError('Could not sync your cloud progress. Using this device for now.')
        } finally {
          setSyncing(false)
          setLoading(false)
        }
      })()
    })

    return () => unsub()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setError('Firebase is not configured yet. Add your project keys to enable login.')
      return
    }
    setError(null)
    setSyncing(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      setError(msg)
      setSyncing(false)
    }
  }, [])

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (!auth) return
    if (getCloudUser()) {
      try {
        await flushCloudSave(exportProgressSnapshot())
      } catch {
        /* ignore */
      }
    }
    await signOut(auth)
    setCloudUser(null)
  }, [])

  const value = useMemo(
    () => ({
      configured: isFirebaseConfigured,
      user,
      loading,
      syncing,
      error,
      signInWithGoogle,
      signOutUser,
    }),
    [user, loading, syncing, error, signInWithGoogle, signOutUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
