import { useEffect, useState } from 'react'
import type { CglCoreId, CglPackConfig } from '../data/cglPack'

const HOURS_KEY = 'exampulse-daily-minutes'
const LOCK_KEY = 'exampulse-foundation-lock'
const CGL_KEY = 'exampulse-cgl-pack'

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

const DEFAULT_CGL: CglPackConfig = {
  core: 'ssccglaso',
  aaoAddon: false,
}

function readCglPack(): CglPackConfig {
  try {
    const raw = localStorage.getItem(CGL_KEY)
    if (!raw) return DEFAULT_CGL
    const parsed = JSON.parse(raw) as Partial<CglPackConfig>
    const core = parsed.core as CglCoreId | undefined
    const valid: CglCoreId[] = [
      'ssccglaso',
      'ssccgliti',
      'ssccglgst',
      'ssccglaao',
    ]
    return {
      core: core && valid.includes(core) ? core : DEFAULT_CGL.core,
      aaoAddon: !!parsed.aaoAddon,
    }
  } catch {
    return DEFAULT_CGL
  }
}

export function useCglPack() {
  const [pack, setPackState] = useState<CglPackConfig>(readCglPack)

  useEffect(() => {
    localStorage.setItem(CGL_KEY, JSON.stringify(pack))
    window.dispatchEvent(new Event('exampulse-settings'))
  }, [pack])

  useEffect(() => {
    const sync = () => setPackState(readCglPack())
    window.addEventListener('exampulse-settings', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('exampulse-settings', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setPack = (next: CglPackConfig) => setPackState(next)
  return [pack, setPack] as const
}
