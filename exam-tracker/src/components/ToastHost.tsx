import { useEffect, useState } from 'react'
import { subscribeToast } from '../utils/toastBus'

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = subscribeToast((msg) => {
      setMessage(msg)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 2800)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  if (!message) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  )
}
