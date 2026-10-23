import { Link } from 'react-router-dom'
import { EXAM_BY_ID } from '../data/exams'
import { useProgress } from '../hooks/useProgress'
import { SECTION_LABELS } from '../utils/prepAnalytics'
import { buildAfterMockFlow } from '../utils/afterMock'

/** F1 — weak section → suggested topics after latest mock. */
export function AfterMockPanel() {
  const { mockScores, isDone, setFocusExam } = useProgress()
  const flow = buildAfterMockFlow({ mockScores, isDone, take: 3 })

  if (!flow.mock) {
    return (
      <section className="after-mock" id="after-mock" aria-label="After mock">
        <h2>After mock</h2>
        <p className="muted-line">
          Log a sectional mock above — we’ll map the weak section to topics.
        </p>
      </section>
    )
  }

  const exam = EXAM_BY_ID[flow.mock.examId]

  return (
    <section className="after-mock" id="after-mock" aria-label="After mock">
      <div className="section-head">
        <h2>After mock</h2>
        <span className="soft-chip">
          {exam?.shortName ?? flow.mock.examId} · {flow.mock.date}
        </span>
      </div>
      {flow.weak && (
        <p className="muted-line plan-intro">
          Weakest: <strong>{SECTION_LABELS[flow.weak.key]}</strong> (
          {flow.weak.avg}%). Do these next:
        </p>
      )}
      <ol className="plan-list">
        {flow.suggestions.map((s, i) => (
          <li key={s.id}>
            <span className="plan-num">{i + 1}</span>
            <div>
              <Link
                to={s.href}
                onClick={() => {
                  if (s.topicId && exam) setFocusExam(exam.id)
                }}
              >
                <strong>{s.title}</strong>
              </Link>
              <em>{s.why}</em>
            </div>
            <span className={`plan-kind ${s.kind}`}>{s.kind}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
