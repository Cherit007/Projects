import { useEffect } from 'react'
import { useProgress } from '../hooks/useProgress'
import { showToast } from '../utils/toastBus'
import { buildWeeklyDigest, digestMessage } from '../utils/weeklyDigest'
import { todayIso } from '../utils/spacedRepetition'

/** F4 — once per day when reminders on, toast deadline digest. */
export function WeeklyDigestHost() {
  const {
    starred,
    remindersEnabled,
    lastDigestAt,
    markDigestShown,
  } = useProgress()

  useEffect(() => {
    if (!remindersEnabled) return
    const today = todayIso()
    if (lastDigestAt === today) return
    // Show at most once per calendar day after mount
    const items = buildWeeklyDigest({ starredIds: starred, withinDays: 30 })
    if (!items.length && starred.length === 0) return
    const t = window.setTimeout(() => {
      showToast(digestMessage(items))
      markDigestShown()
    }, 1200)
    return () => window.clearTimeout(t)
  }, [remindersEnabled, lastDigestAt, starred, markDigestShown])

  return null
}
