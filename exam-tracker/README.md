# ExamPulse

Personal exam-prep tracker for bank, regulator, tech, and PSU targets.

## Features

- All target exams from the OBC jobs canvas (dates, vacancies, pay, rounds, status)
- Shared topic IDs — tick once; syncs across exams that share that topic
- Favorites, deprioritize, readiness, mocks, reminders
- **Google login (Firebase)** — progress personalized per user and synced to the cloud
- Offline fallback via `localStorage` + JSON backup in Prep lab

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
