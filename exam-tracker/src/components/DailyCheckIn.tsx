import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { todayIso } from '../utils/spacedRepetition'
import { buildTodayPlan } from '../utils/readiness'
import { buildRoadmap } from '../utils/roadmap'
import { useMemo } from 'react'

/** F2 — one primary task + done-for-today. */
export function DailyCheckIn() {
  const {
    roadmapStarred,
    completed,
    mockScores,
    weakAreas,
    isDone,
    isSubDone,
    checkInDoneDate,
    markCheckInDone,
    clearCheckIn,
    stats,
  } = useProgress()

  const doneToday = checkInDoneDate === todayIso()
  const weakIds = useMemo(
    () => weakAreas.map((w) => w.topic.id),
    [weakAreas],
  )

  const primary = useMemo(() => {
    if (roadmapStarred.length) {
      const next = buildRoadmap({
        starredIds: roadmapStarred,
        completed,
        isDone,
        isSubDone,
        weakTopicIds: weakIds,
      }).find((i) => !i.fullyDone)
      if (next) {
        return {
          title: next.topic.title,
          why: `${next.examLabels.slice(0, 2).join(' · ')} · ~${next.hoursLeft}h left`,
          href: '/focus',
        }
      }
    }
    const plan = buildTodayPlan({
      completed,
      starred: roadmapStarred,
      mockScores,
      weakTopicIds: weakIds,
    })
    const first = plan[0]
    if (!first) return null
    return { title: first.title, why: first.why, href: first.href }
  }, [
    roadmapStarred,
    completed,
    isDone,
    isSubDone,
    weakIds,
    mockScores,
  ])

  return (
    <section className="daily-checkin" aria-label="Daily check-in">
      <div className="section-head">
        <h2>Check-in</h2>
        <span className="soft-chip">
          {doneToday ? 'Done for today' : `${stats.minutesToday}m logged`}
        </span>
      </div>
      {doneToday ? (
        <p className="checkin-done">
          You’re clear for today. Keep the streak — come back tomorrow.
          <button type="button" className="ghost" onClick={clearCheckIn}>
            Undo
          </button>
        </p>
      ) : (
        <>
          {primary ? (
            <div className="checkin-primary">
              <div>
                <em>Primary task</em>
                <strong>{primary.title}</strong>
                <span>{primary.why}</span>
              </div>
              <Link to={primary.href} className="btn primary">
                Start
              </Link>
            </div>
          ) : (
            <p className="muted-line">Star an exam to get a primary task.</p>
          )}
          <button
            type="button"
            className="btn ghost-btn checkin-finish"
            onClick={markCheckInDone}
          >
            Mark done for today
          </button>
        </>
      )}
    </section>
  )
}
