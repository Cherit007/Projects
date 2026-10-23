import { DEADLINES } from '../data/deadlines'
import { EXAM_BY_ID } from '../data/exams'
import type { AppState } from '../hooks/useProgress'
import type { RoadmapItem } from './roadmap'
import { PHASE_LABELS } from './roadmap'
import type { WeekSlot } from './weekPlan'

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

/** Export this week’s slots as calendar events (ICS). */
export function downloadRoadmapIcs(
  slots: WeekSlot[],
  filename = 'exampulse-week-plan.ics',
) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ExamPulse//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const slot of slots) {
    const stamp = slot.dateIso.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:week-${slot.dateIso}-${slot.kind}@exampulse`,
      `DTSTAMP:${stamp}T090000Z`,
      `DTSTART;VALUE=DATE:${stamp}`,
      `SUMMARY:${icsEscape(`[${slot.kind}] ${slot.title}`)}`,
      `DESCRIPTION:${icsEscape(slot.why)}`,
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

/** Open a printable roadmap document (browser → Save as PDF). */
export function printRoadmapPdf(args: {
  items: RoadmapItem[]
  etaLabel: string
  hoursLeft: number
  starredLabels: string[]
}) {
  const rows = args.items
    .filter((i) => !i.fullyDone)
    .slice(0, 40)
    .map(
      (i, idx) =>
        `<tr><td>${idx + 1}</td><td>${escapeHtml(i.topic.title)}</td><td>${escapeHtml(PHASE_LABELS[i.phase])}</td><td>${i.hoursLeft}h</td><td>×${i.weight.toFixed(1)}</td><td>${escapeHtml(i.examLabels.join(', '))}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>ExamPulse Roadmap</title>
<style>
  body{font-family:Georgia,serif;padding:24px;color:#122;}
  h1{font-size:1.4rem;margin:0 0 .35rem}
  p{color:#445;margin:.2rem 0 1rem}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667}
</style></head><body>
<h1>ExamPulse roadmap</h1>
<p>${escapeHtml(args.starredLabels.join(' · '))} · ${args.hoursLeft}h left · ETA ${escapeHtml(args.etaLabel)}</p>
<table><thead><tr><th>#</th><th>Topic</th><th>Phase</th><th>Hours</th><th>Weight</th><th>Exams</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No pending topics</td></tr>'}</tbody></table>
<script>window.onload=()=>window.print()</script>
</body></html>`

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
