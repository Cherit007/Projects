import { Link, useNavigate } from 'react-router-dom'
import { Pomodoro } from '../components/Pomodoro'
import { SyllabusChecklist } from '../components/SyllabusChecklist'
import { EXAM_BY_ID, EXAMS, examTopicIds } from '../data/exams'
import { TOPIC_BY_ID } from '../data/topics'
import { useProgress } from '../hooks/useProgress'

export function FocusPage() {
  const navigate = useNavigate()
  const {
    focusExamId,
    setFocusExam,
    focusTopicId,
    setFocusTopic,
    isDone,
    stats,
    starred,
  } = useProgress()
  const exam = focusExamId ? EXAM_BY_ID[focusExamId] : null
  const examStat = stats.byExam.find((s) => s.examId === focusExamId)
  const options = [...EXAMS].sort((a, b) => {
    const as = starred.includes(a.id) ? 0 : 1
    const bs = starred.includes(b.id) ? 0 : 1
    return as - bs || a.priority - b.priority
  })

  if (!exam) {
    return (
      <div className="focus-page">
        <h1>Focus mode</h1>
        <p className="lede">Pick one exam. Hide the noise. Work the syllabus.</p>
        <div className="focus-picker">
          {options.map((e) => (
            <button
              key={e.id}
              type="button"
              className="focus-pick"
              onClick={() => setFocusExam(e.id)}
            >
              <strong>{e.shortName}</strong>
              <span>{e.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const ids = examTopicIds(exam)
  const pending = ids.filter((id) => !isDone(id))
  const topic = focusTopicId ? TOPIC_BY_ID[focusTopicId] : null

  return (
    <div className="focus-page active">
      <header className="focus-bar">
        <div>
          <p className="eyebrow">Focus mode</p>
          <h1>{exam.shortName}</h1>
          <p className="lede">
            {examStat?.pct ?? 0}% · {pending.length} topics left · today{' '}
            {stats.minutesToday} min logged · streak {stats.streak}
          </p>
        </div>
        <div className="focus-actions">
          <Link to={`/exam/${exam.id}`} className="ghost">
            Full detail
          </Link>
          <button type="button" className="ghost" onClick={() => setFocusExam(null)}>
            Switch exam
          </button>
          <button type="button" className="btn primary" onClick={() => navigate('/prep')}>
            Log study
          </button>
        </div>
      </header>
      <label className="focus-topic-pick">
        <span>Timer logs to topic</span>
        <select
          value={focusTopicId ?? ''}
          onChange={(e) => setFocusTopic(e.target.value || null)}
        >
          <option value="">Any / general</option>
          {pending.slice(0, 40).map((id) => (
            <option key={id} value={id}>
              {TOPIC_BY_ID[id]?.title ?? id}
            </option>
          ))}
        </select>
      </label>
      <div className="focus-layout">
        <Pomodoro
          examId={exam.id}
          topicId={focusTopicId}
          topicLabel={topic?.title}
        />
        <SyllabusChecklist exam={exam} />
      </div>
    </div>
  )
}
