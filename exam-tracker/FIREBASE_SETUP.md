# ExamPulse cloud login (Firebase — free Spark plan)

Personalized sync: each Google account gets its own favorites, syllabus ticks, mocks, deprioritized list, docs checklist, and reminders flag.

## 1. Create project (5 minutes)

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project** (name e.g. `exampulse`).
2. Disable Google Analytics if you want (optional).
3. **Build → Authentication → Get started → Sign-in method → Google → Enable** → save.
4. **Build → Firestore Database → Create database** → Production mode → pick a region (e.g. `asia-south1`).
5. **Firestore → Rules** → paste contents of `firestore.rules` → **Publish**.
6. **Project settings → Your apps → Web (`</>`)** → register app `ExamPulse`.
7. Copy the `firebaseConfig` values.

## 2. Authorized domains

Authentication → Settings → Authorized domains — ensure:

- `localhost`
- `cherit007.github.io`

## 3. Local env

```bash
cd exam-tracker
cp .env.example .env.local
# paste VITE_FIREBASE_* values
npm run dev
```

Click **Sign in with Google** in the top bar.

## 4. GitHub Pages deploy secrets

Repo → Settings → Secrets and variables → Actions — add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Then re-run the **Deploy ExamPulse to GitHub Pages** workflow (or push a change under `exam-tracker/`).

## How sync works

- Logged out: data stays in browser `localStorage` only.
- Sign in: local + cloud merge (union of ticks/stars; logs merged by id), then cloud becomes the sync target.
- Every change debounces up to Firestore `users/{yourUid}`.
- Sign out: last state remains on this device; other devices keep their last cloud pull until you sign in again.
