# ExamPulse — Topics, Roadmap & Prep Features

Checklist for visual topics, favorites roadmap, and systematic prep.
Mark items done as they ship. Keep UI clean and mobile-responsive.

## Phase A — Visual topics

- [x] **A1** Topic card grid (area chip, progress, shared exams, status)
- [x] **A2** Filters: area / pending / done / weak / ★ syllabus only
- [x] **A3** View toggle: Cards · List · Matrix (topic × ★ exams)
- [x] **A4** Subtopic progress on cards
- [x] **A5** Shared-exam chips link to exam detail
- [ ] **A6** “Shared win” toast when a tick updates multiple exams *(later)*

## Phase B — Roadmap for favorites

- [x] **B1** `/roadmap` page from ★ exams (union syllabus)
- [x] **B2** Daily study minutes → hours left + ETA days/weeks
- [x] **B3** Ordered queue: shared foundation → exam-specific → mocks
- [x] **B4** Per-favorite readiness strip + ETA
- [x] **B5** “Start next” → Focus with that exam
- [x] **B6** Dashboard uses roadmap for today’s moves when ★ set

## Phase C — Systematic prep engine

- [ ] **C1** Auto “This week” 7-slot plan
- [ ] **C2** Optional foundation lock before deep streams
- [ ] **C3** Mock cadence reminders (sectionals + full)
- [ ] **C4** Weak-section → suggested topics (deeper)
- [ ] **C5** Deadline-aware mock-heavy mode

## Phase D — Accuracy & depth

- [x] **D1** Default topic effort hours (by area + overrides)
- [ ] **D2** Per-exam topic weights in data
- [ ] **D3** Mastery states: Learning / Practiced / Mastered
- [ ] **D4** CGL preference pack (one core + AAO Paper-III add-on UI)
- [ ] **D5** PYQ links on topic cards
- [ ] **D6** Export roadmap PDF / ICS

## Phase E — Polish

- [ ] **E1** Compare two roadmaps (e.g. SEBI-primary vs CGL-primary)
- [ ] **E2** Coach weekly template preset
- [ ] **E3** Mobile bottom nav: Targets · Topics · Roadmap · Prep
- [ ] **E4** “Ignore exam for roadmap” without unstarring

## UX / quality gates (every phase)

- [x] Responsive layout ≤560px and ≤900px
- [x] No horizontal overflow on topic/roadmap grids
- [x] Touch-friendly filters and cards
- [x] `npm run build` passes

## How to verify

```bash
cd exam-tracker
npm install
npm run build
npm run preview
```

Open Topics → switch Cards / List / Matrix. Star 2–3 exams → Roadmap → set daily hours → Start next.
