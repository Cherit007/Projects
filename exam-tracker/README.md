# ExamPulse

Personal exam-prep tracker for bank, regulator, tech, PSU, and SSC targets.

## Features

- Target exam cards (dates, vacancies, pay, apply/notification links)
- Shared topic graph — tick once; syncs across linked exams
- **Topics** — card / list / matrix views, ★ syllabus filter
- **Roadmap** — timed plan from starred exams (foundation → specific → polish)
- Favorites, deprioritize, readiness, mocks, error notebook, spaced revision
- Google login (Firebase) + `localStorage` / JSON backup

Feature checklist (phased): [`FEATURES.md`](./FEATURES.md)

## Run

```bash
cd exam-tracker
npm install
cp .env.example .env.local   # add Firebase keys — see FIREBASE_SETUP.md
npm run dev
```

## Build / GitHub Pages

```bash
npm run build          # local /
npm run build:pages    # /Projects/exam-tracker/ for GitHub Pages
```

Live: https://cherit007.github.io/Projects/exam-tracker/

Cloud login needs Firebase env vars — full steps in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md).
