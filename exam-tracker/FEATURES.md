# ExamPulse — Topics, Roadmap & Prep Features

Checklist for visual topics, favorites roadmap, and systematic prep.
Mark items done as they ship. Keep UI clean and mobile-responsive.

## Phase A — Visual topics

- [x] **A1** Topic card grid (area chip, progress, shared exams, status)
- [x] **A2** Filters: area / pending / done / weak / ★ syllabus only
- [x] **A3** View toggle: Cards · List · Matrix (topic × ★ exams)
- [x] **A4** Subtopic progress on cards
- [x] **A5** Shared-exam chips link to exam detail
- [x] **A6** “Shared win” toast when a tick updates multiple exams

## Phase B — Roadmap for favorites

- [x] **B1** `/roadmap` page from ★ exams (union syllabus)
- [x] **B2** Daily study minutes → hours left + ETA days/weeks
- [x] **B3** Ordered queue: shared foundation → exam-specific → mocks
- [x] **B4** Per-favorite readiness strip + ETA
- [x] **B5** “Start next” → Focus with that exam
- [x] **B6** Dashboard uses roadmap for today’s moves when ★ set

## Phase C — Systematic prep engine

- [x] **C1** Auto “This week” 7-slot plan
- [x] **C2** Optional foundation lock before deep streams
- [x] **C3** Mock cadence reminders (sectionals + full)
- [x] **C4** Weak-section → suggested topics (Thu drill from mock sections)
- [x] **C5** Deadline-aware mock-heavy mode (&lt;30 days → Wed + Sat mocks)

## Phase D — Accuracy & depth

- [x] **D1** Default topic effort hours (by area + overrides)
- [x] **D2** Per-exam topic weights in data
- [x] **D3** Mastery states: Learning / Practiced / Mastered
- [x] **D4** CGL preference pack (one core + AAO Paper-III add-on UI)
- [x] **D5** PYQ links on topic cards
- [x] **D6** Export roadmap PDF / ICS

## Phase E — Polish

- [x] **E1** Compare two roadmaps (e.g. SEBI-primary vs CGL-primary)
- [x] **E2** Coach weekly template preset
- [x] **E3** Mobile bottom nav: Targets · Topics · Roadmap · Prep
- [x] **E4** “Ignore exam for roadmap” without unstarring

## Phase F — Loops & rituals (from prep-app patterns)

- [x] **F1** After-mock flow: weak section → suggested topics (one screen)
- [x] **F2** Daily check-in: one primary task + “done for today”
- [x] **F3** Error notebook → auto bump / create SM-2 revision card
- [x] **F4** Weekly digest: apply / exam deadlines in next 7–30 days
- [x] **F5** CGL post-preference rank helper (ordered tradeoffs)
- [x] **F6** Focus timer logs minutes to the active topic

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

1. Star 2–3 exams → Roadmap → toggle **Foundation lock** → check locked phases  
2. Dashboard / Roadmap → **This week** (Mon–Sun slots)  
3. Tick a shared topic on Topics → toast “Synced across N exams”  
4. With a deadline &lt;30 days on a starred exam → **Deadline mode** chip + Wed mock  
5. Dashboard → **CGL preference pack** → star core + optional AAO add-on  
6. Topics → cycle mastery + open PYQ links on a card  
7. Roadmap → **Export PDF** / **Export week ICS**  
8. Mobile → bottom nav Targets / Topics / Roadmap / Prep  
9. Roadmap → ignore a ★ exam without unstarring  
10. Compare → two primary packs (roadmap hours / ETA)  
11. Prep lab → log mock → **After mock** suggestions  
12. Dashboard → daily check-in → mark done for today  
13. Focus → pick topic → finish Pomodoro → study log has topicId  
