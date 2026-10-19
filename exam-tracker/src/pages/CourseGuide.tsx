import { Link } from 'react-router-dom'

const OLIVEBOARD_TESTS =
  'https://u1.oliveboard.in/tests/?c=dashboard&i=banking'
const OLIVEBOARD_HOME = 'https://www.oliveboard.in/'

type ExamBlock = {
  id: string
  title: string
  oliveboardPick: string
  why: string
  stages: { name: string; syllabus: string; oliveUse: string }[]
  skip?: string
}

const YOUR_EXAMS: ExamBlock[] = [
  {
    id: 'ibpsso',
    title: 'IBPS SO – IT Officer (your #1)',
    oliveboardPick: 'IBPS SO / IT Officer',
    why: 'Closest bank role to SDE. Prelims = aptitude only; Mains = IT Professional Knowledge decides rank.',
    stages: [
      {
        name: 'Prelims (qualifying)',
        syllabus: 'English + Reasoning + Quant — same family as bank PO prelims. Marks do not count in final merit.',
        oliveUse:
          'Tests → IBPS SO → Prelims mocks + sectional (Quant / Reasoning / English). Or reuse IBPS PO Prelims mocks for speed.',
      },
      {
        name: 'Mains (merit)',
        syllabus:
          'IT Professional Knowledge: DBMS, OS, Networking, DSA basics, Software Engg, Security, Web, Cloud basics, Banking IT terms.',
        oliveUse:
          'Courses → SO IT / Professional Knowledge batch. Tests → IBPS SO Mains / IT PK topic tests. This is where CSE/ECE edge shows.',
      },
      {
        name: 'Interview',
        syllabus: 'Projects + banking basics + why SO IT (not PO) + OBC-NCL docs.',
        oliveUse: 'Interview / GD modules if in Super Elite; otherwise revise your SDE projects + bank IT roles.',
      },
    ],
  },
  {
    id: 'ibpspo',
    title: 'IBPS PO / MT',
    oliveboardPick: 'IBPS PO',
    why: 'Generalist PSB officer. Huge vacancies; aptitude-heavy. Same Quant/Reasoning/English stack as SO Prelims.',
    stages: [
      {
        name: 'Prelims',
        syllabus: 'Eng + Quant + Reasoning (100). Sectional timing.',
        oliveUse: 'Tests → IBPS PO → Prelims full mocks + topic tests. Live weekend mocks matter.',
      },
      {
        name: 'Mains',
        syllabus:
          'Objective: Reasoning & DI, GA/Banking Awareness, English, Quant. + Descriptive English (essay/letter).',
        oliveUse:
          'IBPS PO Mains mocks + GA/Banking + Descriptive English. Thunderbolt / CA magazine for current affairs.',
      },
      {
        name: 'Interview',
        syllabus: 'HR + banking awareness. Final ≈ Mains 80 : Interview 20.',
        oliveUse: 'Interview kit after mains shortlist.',
      },
    ],
  },
  {
    id: 'sbi',
    title: 'SBI PO',
    oliveboardPick: 'SBI PO',
    why: 'Same aptitude family as IBPS PO; often tougher cutoffs + GE (group exercise) in Phase III.',
    stages: [
      {
        name: 'Prelims → Mains → Phase III',
        syllabus:
          'Same Eng/Quant/Reasoning + Mains GA/DI + Descriptive. Then psychometric + GE + interview.',
        oliveUse:
          'Tests → SBI PO. You can share most prep with IBPS PO; switch mocks when SBI window is live.',
      },
    ],
  },
  {
    id: 'sebi',
    title: 'SEBI Grade A – IT stream (watch)',
    oliveboardPick: 'Regulatory / SEBI (if listed) — else keep aptitude + IT PK warm',
    why: 'Best prestige fit for ECE+SDE on IT stream. Banking Super Elite covers aptitude; IT paper = SO IT–style tech.',
    stages: [
      {
        name: 'Phase I / II',
        syllabus:
          'Aptitude screening + IT stream paper. Skip deep ESI/FM unless you later pick General stream.',
        oliveUse:
          'Keep Quant/Reasoning/English + IT PK. Do NOT buy/start EduTap ESI-FM combo unless you switch to General.',
      },
    ],
    skip: 'Commerce-heavy General stream (ESI + FM) — not your path.',
  },
]

const UI_STEPS = [
  {
    title: '1. Open your course, not the public exam picker',
    body: 'After login, use My Courses / Courses for Banking Super Elite live + recorded classes. The URL you opened (tests dashboard) is the mock-test side — it shows every banking exam tile; that is normal and confusing.',
  },
  {
    title: '2. On Tests dashboard — pick only these tiles',
    body: 'IBPS SO (IT), IBPS PO, SBI PO. Ignore Clerk, RRB Clerk, random private-bank tiles, and state exams unless you intentionally add them later.',
  },
  {
    title: '3. Classes vs Tests',
    body: 'Classes / Courses = learn topics (foundation → practice → advanced). Tests = full mocks, sectionals, topic tests, live mocks. Do both: learn weak topic → topic test → sectional → full mock.',
  },
  {
    title: '4. SO IT Professional Knowledge',
    body: 'Look for “SO IT”, “IT Officer”, or “Professional Knowledge” batches inside Super Elite. Prelims aptitude alone will not get you selected — Mains IT paper is the filter.',
  },
  {
    title: '5. Current affairs',
    body: 'Use Thunderbolt / monthly CA PDFs lightly for PO mains GA. For SO IT mains, CA is secondary to IT PK.',
  },
]

export function CourseGuide() {
  return (
    <div className="course-guide">
      <header className="section-head stack">
        <div>
          <p className="eyebrow">Oliveboard Banking Super Elite</p>
          <h1>Exam intro + syllabus map</h1>
          <p className="lede">
            Super Elite unlocks almost every bank exam tile — that is why the UI
            feels noisy. You only need a short path: aptitude shared across PO/SO,
            then IT Professional Knowledge for SO IT.
          </p>
        </div>
        <div className="hero-cta">
          <a
            className="btn"
            href={OLIVEBOARD_TESTS}
            target="_blank"
            rel="noreferrer"
          >
            Open Oliveboard Tests
          </a>
          <a
            className="btn ghost"
            href={OLIVEBOARD_HOME}
            target="_blank"
            rel="noreferrer"
          >
            Oliveboard home / My Courses
          </a>
        </div>
      </header>

      <section className="guide-panel">
        <h2>How to read the Oliveboard UI</h2>
        <ol className="guide-steps">
          {UI_STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-panel accent">
        <h2>Your 4-week focus (simple)</h2>
        <div className="focus-grid">
          <div>
            <h3>Daily (shared)</h3>
            <p>Quant + Reasoning + English — use IBPS PO or IBPS SO Prelims mocks.</p>
          </div>
          <div>
            <h3>SO IT edge</h3>
            <p>IT PK topics (DBMS, OS, CN, Security, SE) — topic tests + PYQs.</p>
          </div>
          <div>
            <h3>PO only add-on</h3>
            <p>Banking/GA + descriptive English when you are also targeting PO mains.</p>
          </div>
          <div>
            <h3>Skip for now</h3>
            <p>ESI, FM, ARD, Clerk batches, obscure bank tiles, RBI Grade B deep dive.</p>
          </div>
        </div>
      </section>

      <section className="exam-intro-list">
        <h2 className="section-title">Exams covered by your course</h2>
        {YOUR_EXAMS.map((exam) => (
          <article key={exam.id} className="exam-intro-card">
            <header>
              <div>
                <h3>{exam.title}</h3>
                <p className="muted">{exam.why}</p>
              </div>
              <Link className="btn ghost small" to={`/exam/${exam.id}`}>
                Full syllabus ticks →
              </Link>
            </header>
            <p className="olive-pick">
              <span>On Oliveboard click</span> <strong>{exam.oliveboardPick}</strong>
            </p>
            <div className="stage-table">
              {exam.stages.map((st) => (
                <div key={st.name} className="stage-row">
                  <h4>{st.name}</h4>
                  <p>
                    <em>Syllabus:</em> {st.syllabus}
                  </p>
                  <p>
                    <em>Use Oliveboard for:</em> {st.oliveUse}
                  </p>
                </div>
              ))}
            </div>
            {exam.skip ? (
              <p className="skip-note">Skip: {exam.skip}</p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="guide-panel">
        <h2>One-line syllabus cheat sheet</h2>
        <ul className="cheat">
          <li>
            <strong>Quant</strong> — arithmetic, DI, simplification, quadratic, number series
          </li>
          <li>
            <strong>Reasoning</strong> — puzzles, seating, inequality, syllogism, input-output
          </li>
          <li>
            <strong>English</strong> — RC, error spotting, cloze, para jumbles (+ descriptive for PO)
          </li>
          <li>
            <strong>GA / Banking</strong> — last 4–6 months CA + RBI/banking basics (PO mains)
          </li>
          <li>
            <strong>IT PK (SO / SEBI IT)</strong> — DBMS, OS, Networking, DSA, Security, SE, Web/Cloud
          </li>
        </ul>
        <p className="muted tight">
          Tick topics on each exam page in ExamPulse so progress stays synced with your
          Google login.
        </p>
      </section>
    </div>
  )
}
