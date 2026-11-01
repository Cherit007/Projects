import { Link } from 'react-router-dom'
import { TOPIC_BY_ID } from '../data/topics'
import {
  QUANT_SECTION_IDS,
  sectionQuestionCount,
} from '../data/quantPracticeBank'

const PYQ_HUBS = [
  {
    label: 'SSC CGL previous papers',
    url: 'https://testbook.com/ssc-cgl/previous-year-papers',
  },
  {
    label: 'IBPS / bank practice papers',
    url: 'https://prepp.in/ibps-po-exam/practice-papers',
  },
  {
    label: 'Adda247 SSC PYQ hub',
    url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
  },
]

export function QuantPracticePage() {
  return (
    <div className="practice-page">
      <header className="section-head stack">
        <div>
          <h1>Quant section tests</h1>
          <p className="lede">
            Take a timed drill by chapter — Number System, DI, SI/CI, and more.
            Questions are original exam-style practice (not copied PYQ PDFs).
          </p>
        </div>
      </header>

      <section className="practice-hubs" aria-label="Official / free PYQ hubs">
        <h2 className="roadmap-section-title">Actual previous papers</h2>
        <p className="muted-line">
          For memory-based / official year papers, open these free hubs (external):
        </p>
        <div className="practice-hub-links">
          {PYQ_HUBS.map((h) => (
            <a
              key={h.url}
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="soft-chip"
            >
              {h.label} ↗
            </a>
          ))}
        </div>
      </section>

      <section aria-label="Section drills">
        <h2 className="roadmap-section-title">Section-wise tests</h2>
        <ul className="practice-section-list">
          {QUANT_SECTION_IDS.map((id) => {
            const topic = TOPIC_BY_ID[id]
            const n = sectionQuestionCount(id)
            if (!topic || !n) return null
            return (
              <li key={id}>
                <Link to={`/practice/quant/${id}`} className="practice-section-row">
                  <div>
                    <strong>{topic.title}</strong>
                    <em>
                      {topic.subtopics.slice(0, 3).join(' · ')}
                      {topic.subtopics.length > 3 ? '…' : ''}
                    </em>
                  </div>
                  <span className="practice-section-meta">
                    {n} Q · start →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
