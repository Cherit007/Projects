import { Link, useParams } from 'react-router-dom'
import { ProgressRing } from '../components/ProgressRing'
import { SyllabusChecklist } from '../components/SyllabusChecklist'
import { EXAM_BY_ID, examTopicIds } from '../data/exams'
import { useProgress } from '../hooks/useProgress'

export function ExamDetail() {
  const { examId = '' } = useParams()
  const exam = EXAM_BY_ID[examId]
  const { stats, isDone } = useProgress()

  if (!exam) {
    return (
      <div className="empty">
        <h1>Exam not found</h1>
        <Link to="/">Back to dashboard</Link>
      </div>
    )
  }

  const examStat = stats.byExam.find((s) => s.examId === exam.id)
  const ids = examTopicIds(exam)
  const done = ids.filter((id) => isDone(id)).length

  return (
    <div className="exam-detail">
      <Link to="/" className="back-link">
        ← All exams
      </Link>

      <header className="detail-hero">
        <div>
          <div className="detail-chips">
            <span className={`tier-chip tier-${exam.tier.toLowerCase()}`}>{exam.tier}</span>
            <span className="soft-chip">{exam.difficulty}</span>
            <span className="soft-chip">Priority #{exam.priority}</span>
          </div>
          <h1>{exam.name}</h1>
          <p className="lede">{exam.fit}</p>
        </div>
        <div className="detail-progress">
          <ProgressRing pct={examStat?.pct ?? 0} size={100} stroke={8} />
          <span>
            {done}/{ids.length} topics
          </span>
        </div>
      </header>

      <div className="detail-grid">
        <aside className="detail-info">
          <InfoBlock title="Status" body={exam.status} tone="warn" />
          <InfoBlock title="Registration" body={exam.reg} />
          <InfoBlock title="Exam timeline" body={exam.exam} />
          <InfoBlock title="Cycle" body={exam.cycle} />
          <InfoBlock title="Vacancies" body={exam.vacancies} />
          <InfoBlock title="OBC seats" body={exam.obcSeats} />
          <InfoBlock title="OBC age" body={exam.obcAge} />
          <InfoBlock title="OBC cutoffs" body={exam.obcCutoff} />
          <InfoBlock title="Qualification" body={exam.qual} />
          <InfoBlock title="Competitiveness" body={exam.competitiveness} />
          <InfoBlock title="Compensation" body={exam.compensation} tone="ok" />
          <InfoBlock title="Perks" body={exam.perks} />
          <InfoBlock title="Location" body={exam.location} />
          <InfoBlock
            title="Applications vs offers"
            body={`${exam.applied}\n\nOffered: ${exam.offered}\n\n${exam.appsNote}`}
          />

          <div className="info-block">
            <h3>Rounds</h3>
            <ol className="rounds">
              {exam.rounds.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>
                  <span>{r.what}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="info-block">
            <h3>Coaching references</h3>
            <div className="chip-wrap">
              {exam.coachingRefs.map((c) => (
                <span key={c} className="soft-chip">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <SyllabusChecklist exam={exam} />
      </div>
    </div>
  )
}

function InfoBlock({
  title,
  body,
  tone,
}: {
  title: string
  body: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className={`info-block ${tone ?? ''}`}>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
