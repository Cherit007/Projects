import { DEADLINES } from '../data/deadlines'
import { EXAM_BY_ID } from '../data/exams'
import type { AppState } from '../hooks/useProgress'

export function downloadJson(state: AppState, filename = 'exampulse-backup.json') {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function icsEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function downloadDeadlinesIcs(filename = 'exampulse-deadlines.ics') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ExamPulse//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const d of DEADLINES) {
    const exam = EXAM_BY_ID[d.examId]
    if (!exam) continue
    const stamp = d.date.replace(/-/g, '')
    const title = `${exam.shortName}: ${d.label}${d.approx ? ' (approx)' : ''}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.examId}-${d.kind}-${stamp}@exampulse`,
      `DTSTAMP:${stamp}T090000Z`,
      `DTSTART;VALUE=DATE:${stamp}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(`${exam.name} — ${exam.status}. Verify official notification.`)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function notifyUpcoming(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    /* ignore */
  }
}
