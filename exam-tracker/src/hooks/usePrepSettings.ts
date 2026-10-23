import { useEffect, useState } from 'react'

const HOURS_KEY = 'exampulse-daily-minutes'
const LOCK_KEY = 'exampulse-foundation-lock'

export function useDailyMinutes(defaultMinutes = 150) {
  const [dailyMinutes, setDailyMinutes] = useState(() => {
    const raw = localStorage.getItem(HOURS_KEY)
    const n = raw ? Number(raw) : defaultMinutes
    return Number.isFinite(n) && n > 0 ? n : defaultMinutes
  })
  useEffect(() => {
    localStorage.setItem(HOURS_KEY, String(dailyMinutes))
  }, [dailyMinutes])
  return [dailyMinutes, setDailyMinutes] as const
}

export function useFoundationLock(defaultOn = true) {
  const [foundationLock, setFoundationLock] = useState(() => {
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw === null) return defaultOn
    return raw !== '0'
  })
  useEffect(() => {
    localStorage.setItem(LOCK_KEY, foundationLock ? '1' : '0')
    window.dispatchEvent(new Event('exampulse-settings'))
  }, [foundationLock])

  useEffect(() => {
    const sync = () => {
      const raw = localStorage.getItem(LOCK_KEY)
      setFoundationLock(raw === null ? defaultOn : raw !== '0')
    }
    window.addEventListener('exampulse-settings', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('exampulse-settings', sync)
      window.removeEventListener('storage', sync)
    }
  }, [defaultOn])

  return [foundationLock, setFoundationLock] as const
}
