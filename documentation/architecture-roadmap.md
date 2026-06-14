# Architecture Roadmap — Multi-Platform & Multi-Sport Evolution

Implementation plan derived from the architecture assessment (June 2026). Work through phases in order where dependencies exist; tasks within a phase can often be done in small batches.

**How to use this doc**

- Check off tasks as completed: `- [x]`
- Each task is scoped to be completable in 1–3 days unless marked **(epic)**
- **Depends on:** notes blockers — do not start until those tasks are done
- **Priority:** P0 = do first, P1 = soon, P2 = later in phase, P3 = optional / when ready
- Source copy lives in `documentation/`; `npm run build` copies `*.md` into `docs/` after Vite output

---

## Pre-Phase 5 completion (Jun 2026)

Phases **1–4 are complete** for mobile handoff. Remaining items below are **deferred** (P2/P3 or operational) and do not block Phase 5.

| Area | Status |
|------|--------|
| **Monorepo** | `apps/web` + `packages/{domain,config,api,types,storage,analytics}` |
| **Domain** | FixtureEngine, ScoringEngine, stats, predictions, narrative in `@fixture-maker/domain` |
| **Multi-sport** | Badminton, pickleball, box cricket plugins; `sportId` in app + API |
| **Utils facades** | Removed `calculations.js`, `matchPredictions.js`, `matchSummary.js` — web imports domain directly |
| **CI** | `npm run lint`, `test:run`, `build`, Playwright smoke |
| **Docs** | `box-cricket-schema.md`, `shareable-tournament-deep-links.md`, `appwrite-v2-migration-status.md` |

**Deferred (not blocking Phase 5):**

- **1.1 P1** — Full ESLint unused-export audit on `apps/web/src` (`lint:web` has known debt)
- **1.3 P2** — `App.jsx` still large (shell hooks extracted; composition-only target ~800 lines)
- **1.7 P0** — Production cutover off `app_meta` (scripts + doc ready; manual Appwrite console work)
- **2.4 P2** — Golden-file fixture output tests
- **3.4 P2** — Pickleball win-by-2 validation in plugin
- **3.6 P3** — npm package rename `badminton-fixture-maker` → `fixture-maker`

**Verification:** 284 unit tests passing; `npm run lint` (0 errors); `npm run build` succeeds.

---

## Recent batch — four parallel tracks (Jun 2026)

| Track | Scope | Status |
|-------|--------|--------|
| **3.9** | Ground allocation + time slots on fixtures | **Done** — `matchSchedule.js`, `MatchSchedulePanel`, conflict detection; see [`box-cricket-scheduling.md`](./box-cricket-scheduling.md) |
| **3.8 follow-ups** | Super over, powerplay, LMS, bonus runs | **Done** — `boxCricketScoring.js`, `BoxCricketRulesPanel`, `BoxCricketLiveMatchView` |
| **3.4 P1** | Badminton plugin golden regression tests | **Done** — `badmintonPluginGolden.unit.test.js` (fixtures, standings, ELO, stats) |
| **Phase 4** | Monorepo / domain extraction | **Done** — `apps/web` + `packages/domain`, npm workspaces |

**Verification:** 284 tests passing; `npm run lint` (packages/scripts); `npm run build` succeeds.

---

## Progress overview

| Phase | Name | Status | Target |
|-------|------|--------|--------|
| 1 | Tech debt cleanup | **Complete** (deferrals: App.jsx size, web ESLint audit, `app_meta` cutover) | Weeks 1–6 |
| 2 | Domain abstraction | **Complete** (deferral: golden-file fixture tests) | Weeks 4–8 |
| 3 | Multi-sport architecture | **Complete** (deferrals: win-by-2 validation, package rename) | Weeks 8–14 |
| 4 | Shared package extraction (monorepo) | **Complete** | Weeks 10–14 |
| 5 | React Native setup | Not started | Weeks 14–22 |
| 6 | Android launch | Not started | Weeks 22–25 |
| 7 | iOS launch | Not started | Weeks 25–28 |
| 8 | Backend evolution | Not started | Weeks 16–28 |
| 9 | Ads & monetization | Not started | Weeks 28–34 |
| 10 | Scaling & optimization | Ongoing | Weeks 30+ |

---

## Phase 1 — Tech debt cleanup

**Goal:** Make the codebase safe to extend and migrate. Reduce god files, finish migrations, remove dead code.

**Exit criteria:** Hash routing live; storage adapter in place; tournament hooks and API split; unused deps removed. *(Deferred: `App.jsx` under 800 lines; full production `app_meta` cutover.)*

### 1.1 Dead code & dependencies

- [x] **P0** Remove unused `zustand` from `package.json` (zero imports in codebase)
- [x] **P0** Delete or archive `src/BadmintonFixtureGenerator.jsx` (not imported anywhere)
- [ ] **P1** Audit and remove any other unused exports flagged by ESLint *(scoped lint passes; `lint:web` on full `apps/web/src` deferred)*
- [x] **P1** Document legacy collection usage in README (read-only / migration-only)

### 1.2 Routing & deep links

- [x] **P0** Wire `useHashAppRoute` into `App.jsx` so URL hash drives `AppViewRouter` route key
- [x] **P0** Sync `appStore.step` changes back to hash (`#/setup`, `#/teams`, `#/live`)
- [x] **P1** Add hash routes for auth and groups (`#/auth`, `#/groups`, `#/viewer`)
- [x] **P1** Add integration test: hash URL → correct screen on load
- [x] **P2** Add shareable tournament deep link design doc (route + query params) — [`shareable-tournament-deep-links.md`](./shareable-tournament-deep-links.md)

**Depends on:** none

### 1.3 Split `App.jsx` **(epic)**

- [x] **P0** Extract theme logic → `hooks/useThemeMode.js` (localStorage + `data-theme`)
- [x] **P0** Extract viewport/mobile detection → `hooks/useMobileViewport.js`
- [x] **P0** Extract keyboard shortcuts → `hooks/useAppKeyboardShortcuts.js`
- [x] **P0** Extract share/WhatsApp helpers → `utils/shareTournament.js`
- [x] **P1** Extract player photo handlers → `hooks/usePlayerPhotoActions.js`
- [x] **P1** Extract template handlers → `hooks/useTemplateActions.js`
- [x] **P1** Extract member/admin handlers → `hooks/useMemberAdminActions.js`
- [x] **P1** Move remaining prop wiring into `useTournamentShell` / new shell hooks
- [ ] **P2** Target: `App.jsx` under 800 lines (composition only)

**Depends on:** none (can do one extraction per PR)

### 1.4 Split `useTournamentActions.js` **(epic)**

- [x] **P0** Extract fixture generation → `hooks/tournament/useFixtureActions.js`
  - `generateFixtures`, `scheduleTournament`, odd-player injection
- [x] **P0** Extract match scoring → `hooks/tournament/useScoringActions.js`
  - `saveMatchResult`, `saveBracketMatchResult`, `saveFinalResult`
- [x] **P0** Extract persistence/sync → `hooks/tournament/useTournamentPersistence.js`
  - Appwrite patch, outbox queue, active lock
- [x] **P1** Extract history/resume → `hooks/tournament/useTournamentHistory.js`
- [x] **P1** Extract casual match actions → `hooks/tournament/useCasualMatchActions.js`
- [x] **P1** Re-export unified API from `useTournamentActions.js` for backward compatibility
- [ ] **P2** Update tests to target split modules directly

**Depends on:** none

### 1.5 Split `tournamentService.js` **(epic)**

- [x] **P0** Extract query/pagination helpers → `packages/api/src/tournament/tournamentQueries.js`
- [x] **P0** Extract team sync → `packages/api/src/tournament/tournamentTeams.js`
- [x] **P0** Extract match sync → `packages/api/src/tournament/tournamentMatches.js`
- [x] **P1** Extract hydration (assemble full tournament) → `packages/api/src/tournament/tournamentHydration.js`
- [x] **P1** Extract patch/delete → `packages/api/src/tournament/tournamentPatch.js`
- [x] **P2** Keep `tournamentService.js` as thin facade re-exporting public API (`@fixture-maker/api`)

**Depends on:** none

### 1.6 Storage abstraction (foundation for RN)

- [x] **P0** Create `src/platform/storage.js` with interface:
  - `getItem`, `setItem`, `removeItem`, `getJson`, `setJson`
- [x] **P0** Implement web adapter using `localStorage` (+ guards for SSR)
- [x] **P0** Migrate `offlineOutboxService.js` to use storage adapter
- [x] **P0** Migrate `queryPersistence.js` to use storage adapter
- [x] **P1** Migrate `localStorageWriteService.js` to use storage adapter
- [x] **P1** Migrate `autoResumePreference.js` to use storage adapter
- [x] **P1** Replace direct `localStorage` calls in `App.jsx` and `useTournamentActions.js`
- [x] **P2** Rename keys from `badminton_*` → `bfm_*` with one-time migration on read

**Depends on:** none

### 1.7 Finish Appwrite V2 migration

- [x] **P0** Audit remaining reads/writes to `app_meta` JSON blob — [`appwrite-v2-migration-status.md`](./appwrite-v2-migration-status.md)
- [ ] **P0** Migrate templates from `app_meta.templates` → dedicated collection or normalized docs *(operational cutover)*
- [ ] **P1** Migrate `app_meta.playerPhotos` refs → consider `v2_players` metadata column
- [ ] **P1** Migrate `app_meta.members` / `memberAccountLinks` if still used alongside group collections
- [ ] **P1** Verify all required V2 indexes exist in Appwrite (see README)
- [x] **P2** Run `scripts/migration/validate-normalized.mjs` and fix gaps *(script + npm `validate:normalized`)*

**Depends on:** none

### 1.8 Test & CI hygiene

- [x] **P1** Add CI script: `npm run test:run && npm run lint`
- [x] **P1** Add coverage target for `src/utils/` (already well tested)
- [x] **P2** Split Playwright smoke into tagged suites (auth, scoring, offline) — `e2e:auth`, `e2e:scoring`, `e2e:offline`, `e2e:pickleball`

---

## Phase 2 — Domain abstraction

**Goal:** Extract sport-agnostic tournament engines from utils. No behavior change for badminton.

**Exit criteria:** `FixtureEngine` and `ScoringEngine` in `@fixture-maker/domain`; web imports domain directly; all existing unit tests pass.

**Depends on:** Phase 1.4–1.5 recommended but not blocking

### 2.1 Fixture engine

- [x] **P0** Create `packages/domain/src/fixture/RoundRobinScheduler.js`
- [x] **P0** Create `packages/domain/src/fixture/KnockoutScheduler.js`
- [x] **P0** Create `packages/domain/src/fixture/FixtureEngine.js` — dispatch by format type
- [x] **P0** Create `packages/domain/src/fixture/index.js` — public exports
- [x] **P1** Removed `apps/web/src/utils/calculations.js` facade — imports use `@fixture-maker/domain` directly
- [x] **P1** Move/adapt tests in `apps/web/src/test/calculations.unit.test.js`
- [ ] **P2** Add `FormatSpec` type/JSDoc for format descriptors

### 2.2 Scoring engine

- [x] **P0** Create `packages/domain/src/scoring/StandingsCalculator.js`
- [x] **P0** Create `packages/domain/src/scoring/EloCalculator.js`
- [x] **P0** Create `packages/domain/src/scoring/ScoringEngine.js`
- [x] **P1** Parameterize `pointsPerWin` via `scoringConfig.js`
- [x] **P1** Parameterize `K_FACTOR` for ELO via config object
- [x] **P1** Update `qualificationScenarios.js` to import `pointsPerWin` from config

### 2.3 Player & stats domain

- [x] **P1** Move `calculatePlayerStats`, `calculateCumulativePlayerStats` → `packages/domain/src/stats/`
- [x] **P1** Move `predictMatchOutcome`, `getUpsetAlert` → `packages/domain/src/predictions/`
- [x] **P2** Move `buildAiMatchSummary` → `packages/domain/src/narrative/`

### 2.4 Domain tests

- [x] **P0** All existing `calculations.unit.test.js` tests pass unchanged
- [x] **P1** Add tests for parameterized `pointsPerWin` and `K_FACTOR`
- [ ] **P2** Add golden-file tests for fixture output shapes

---

## Phase 3 — Multi-sport architecture

**Goal:** Support multiple sports via configuration. Badminton remains default. Pickleball first; Box Cricket scoped.

**Exit criteria:** Tournaments carry `sportId`; UI labels/icons from sport config; Pickleball creatable end-to-end.

**Depends on:** Phase 2 complete

### 3.1 Sport config registry

- [x] **P0** Create `packages/domain/src/sports/types.js` — SportConfig shape
- [x] **P0** Create `packages/domain/src/sports/badminton.config.js`
- [x] **P0** Create `packages/domain/src/sports/pickleball.config.js`
- [x] **P1** Create `packages/domain/src/sports/boxCricket.config.js`
- [x] **P0** Create `packages/domain/src/sports/index.js` — `getSport(id)`, `listSports()`

### 3.2 Database schema

- [x] **P0** Add `sportId` attribute to `v2_tournaments` in Appwrite (string, default `badminton`) — API + types; confirm in console
- [x] **P0** Update tournament service create/update to read/write `sportId`
- [x] **P0** Backfill script: set `sportId: 'badminton'` on all existing tournaments — `scripts/migration/backfill-sport-id.mjs`
- [ ] **P1** Add index on `groupId + sportId` if filtering by sport needed
- [x] **P2** Design doc for Box Cricket match schema — [`box-cricket-schema.md`](./box-cricket-schema.md)

### 3.3 App store & UI — sport selection

- [x] **P0** Add `sportId` to `appStore` (default `'badminton'`)
- [x] **P0** Add sport picker to `SetupScreen.tsx` (list from sport registry)
- [x] **P1** Drive game mode options from sport config (hide mixed for pickleball if N/A)
- [x] **P1** Drive tournament format options from sport config
- [x] **P1** Replace hardcoded 🏸 emoji defaults with sport config icon
- [x] **P2** Sport-specific quick-score presets in `LiveMatchView` (optional per sport)

### 3.4 Pickleball implementation

- [x] **P0** Pickleball scoring config: points per win, suggested quick scores (11, 15, 21)
- [x] **P1** Pickleball sport copy in sport `narrativeCopy` config + `buildHomeNarratives`
- [x] **P1** E2E smoke: create pickleball tournament, score match, verify standings — `@pickleball` tagged test
- [ ] **P2** Pickleball-specific validation rules (win by 2) in sport plugin

### 3.5 Box Cricket scoping (design only — implementation later)

- [x] **P1** Write [`box-cricket-schema.md`](./box-cricket-schema.md) — team model, innings, overs, result shape
- [x] **P1** Define `participantModel: 'team'` with squad list in sport config
- [x] **P2** Spike: `BoxCricketScheduler` interface (team vs team, not round-robin circle)
- [x] **P3** Implement Box Cricket scoring plugin — `BoxCricketPlugin`, live UI, scheduling (see Phase 10.4)

### 3.6 Rename & decouple badminton branding

- [x] **P1** Rename storage keys `badminton_*` → `bfm_*` (with migration — see Phase 1.6)
- [x] **P2** Rename app display strings to be sport-neutral where appropriate ("Tournament" not "Badminton Tournament")
- [ ] **P3** Consider package rename `badminton-fixture-maker` → `fixture-maker` (optional, breaking)

---

## Phase 4 — Shared package extraction (monorepo)

**Goal:** Turborepo/Nx monorepo with shared domain and API packages consumed by web (and later mobile).

**Exit criteria:** Web app builds from `apps/web`; domain tests run in `packages/domain`; no duplicate logic.

**Depends on:** Phase 2 complete; Phase 3.1–3.2 recommended

### 4.1 Monorepo scaffold

- [x] **P0** Choose tool: Turborepo (recommended) or Nx
- [x] **P0** Create root npm workspaces config (`apps/*`, `packages/*`)
- [x] **P0** Move current app → `apps/web/` (Vite config, src, public, index.html)
- [x] **P0** Verify `apps/web` dev and build work (`npm run dev`, `npm run build`)
- [x] **P1** Update GitHub Pages deploy path (`gh-pages -d docs`)
- [x] **P1** Update ESLint, Vitest, Playwright paths

### Phase 4.2 — packages/api + packages/config (Jun 2026)

| Package | Contents |
|---------|----------|
| `@fixture-maker/config` | `queryKeys`, Appwrite env/collections, auxiliary feature flags |
| `@fixture-maker/api` | Appwrite client, auth, player, groups, casual, tournament, templates services |
| `@fixture-maker/types` | Shared Zod schemas (`tournamentSchemas`) |
| `@fixture-maker/storage` | Storage adapter + web localStorage/sessionStorage impl |
| `@fixture-maker/analytics` | Event catalog + `trackEvent` + adapter hook |

Web-only services stay in `apps/web/src/services/`: `groupService`, `localStorageWriteService`, `offlineOutboxService`, `analyticsWorkerService`, `appAuxiliaryDataService`.

---

- [x] **P0** Create `packages/domain/` — move Phase 2 domain + sport plugins
- [x] **P0** Create `packages/domain/package.json` with exports map
- [x] **P0** Create `packages/api/` — Appwrite services (no React imports)
- [x] **P0** Create `packages/config/` — query keys, env schema, sport configs
- [x] **P1** Create `packages/types/` — shared Zod schemas (tournament, match, team)
- [x] **P1** Create `packages/storage/` — storage adapter interface + web impl
- [x] **P2** Create `packages/analytics/` — event name constants + typed payloads

### 4.3 Web app migration

- [x] **P0** Replace `src/domain/*` imports with `@fixture-maker/domain`
- [x] **P0** Replace service imports with `@fixture-maker/api` (thin re-exports remain in `apps/web/src/services/` for compat)
- [x] **P1** Remove duplicated code from `apps/web/src/utils/` — `calculations.js`, `matchPredictions.js`, `matchSummary.js` deleted; domain imports direct
- [x] **P1** Add workspace scripts: `turbo run test`, `turbo run build`, `turbo run lint` (Turbo config present; root scripts delegate to Vite)

### 4.4 Analytics event foundation

- [x] **P0** Define event catalog in `packages/analytics/events.js`
- [x] **P1** Create `trackEvent(name, payload)` noop impl (console in dev)
- [x] **P1** Instrument `useScoringActions` and tournament create/start flows
- [x] **P2** Prepare adapter interface for PostHog / Firebase / Amplitude (`setAnalyticsAdapter`, noop adapter)

---

## Phase 5 — React Native setup

**Goal:** Expo-based mobile app sharing domain and API packages. Core flows working on simulator.

**Exit criteria:** Auth, group select, create tournament, score live match on iOS simulator and Android emulator.

**Depends on:** Phase 4 complete

### 5.1 Expo scaffold

- [ ] **P0** Create `apps/mobile/` with Expo (SDK 52+)
- [ ] **P0** Configure TypeScript (match web strictness)
- [ ] **P0** Add `@fixture-maker/domain`, `@fixture-maker/api`, `@fixture-maker/config` as deps
- [ ] **P0** Configure Appwrite env (`EXPO_PUBLIC_*` mirroring `VITE_*`)
- [ ] **P1** Setup EAS Build profiles (development, preview, production)

### 5.2 Navigation & auth

- [ ] **P0** Install React Navigation (native stack + bottom tabs)
- [ ] **P0** Map routes: Auth, Groups, Setup, Teams, Tournament (match web route keys)
- [ ] **P0** Implement Auth screen (email/password via `@fixture-maker/api`)
- [ ] **P0** Implement Group Access screen
- [ ] **P1** Deep linking config (`fixturemaker://` + universal links placeholder)

### 5.3 Storage & offline

- [ ] **P0** Implement `packages/storage/native.ts` with `@react-native-async-storage/async-storage`
- [ ] **P0** Wire TanStack Query with async storage persister
- [ ] **P0** Port offline outbox to use native storage adapter
- [ ] **P1** NetInfo listener for online/offline flush (replace service worker)
- [ ] **P2** MMKV adapter for performance-critical keys

### 5.4 Core screens (MVP)

- [ ] **P0** Setup screen — sport picker, format, create/schedule tournament
- [ ] **P0** Team entry screen
- [ ] **P0** Tournament view — fixtures tab + live scoring
- [ ] **P1** Table tab (standings)
- [ ] **P1** Stats tab
- [ ] **P2** Bracket/knockout view
- [ ] **P2** Casual match screen
- [ ] **P2** Player profile modal

### 5.5 Mobile-specific features

- [ ] **P1** Replace `lucide-react` → `lucide-react-native`
- [ ] **P1** Replace framer-motion → `react-native-reanimated` / `moti` for key animations
- [ ] **P1** Haptics via `react-native-haptic-feedback` (replace `utils/haptics.js`)
- [ ] **P1** Share via RN Share API (replace `navigator.share`)
- [ ] **P2** Image picker + crop for player photos (`react-native-image-crop-picker`)
- [ ] **P2** Run analytics on main thread (replace Comlink web worker)

### 5.6 Mobile testing

- [ ] **P1** Jest unit tests for domain usage in mobile
- [ ] **P1** Detox or Maestro E2E: login → create tournament → score match
- [ ] **P2** Test offline outbox flush on device

---

## Phase 6 — Android launch

**Goal:** Production-ready Android app on Google Play.

**Depends on:** Phase 5 MVP complete

### 6.1 Play Store prep

- [ ] **P0** Generate signed AAB via EAS Build
- [ ] **P0** App icon, feature graphic, screenshots (phone + tablet)
- [ ] **P0** Privacy policy URL (required for Play Store)
- [ ] **P0** Play Console listing copy (sport-neutral branding)
- [ ] **P1** Content rating questionnaire
- [ ] **P1** Data safety form (Appwrite data collection disclosure)

### 6.2 Android-specific

- [ ] **P1** Test on 3+ physical devices (various API levels)
- [ ] **P1** Back button behavior with React Navigation
- [ ] **P1** Edge-to-edge / status bar theming
- [ ] **P2** Push notification setup (FCM) — optional for v1
- [ ] **P2** App size optimization (Hermes, ProGuard/R8)

### 6.3 Launch

- [ ] **P0** Internal testing track upload
- [ ] **P0** Closed beta with real group (1–2 weeks)
- [ ] **P0** Production release

---

## Phase 7 — iOS launch

**Goal:** Production-ready iOS app on App Store.

**Depends on:** Phase 5 MVP complete (can parallel with Phase 6)

### 7.1 App Store prep

- [ ] **P0** Apple Developer account + App ID + provisioning
- [ ] **P0** Generate signed IPA via EAS Build
- [ ] **P0** App icon, screenshots (6.7", 6.1", iPad if supporting)
- [ ] **P0** Privacy policy + App Store description
- [ ] **P1** App Privacy nutrition labels

### 7.2 iOS-specific

- [ ] **P0** ATT (App Tracking Transparency) prompt if ads planned
- [ ] **P1** Test on physical iPhone + iPad
- [ ] **P1** Safe area / notch handling audit
- [ ] **P2** Push notification setup (APNs) — optional for v1
- [ ] **P2** Sign in with Apple (required if other social login added later)

### 7.3 Launch

- [ ] **P0** TestFlight beta
- [ ] **P0** App Store review submission
- [ ] **P0** Production release

---

## Phase 8 — Backend evolution

**Goal:** Server-side validation, webhooks, and aggregation without replacing Appwrite.

**Depends on:** Phase 4; can start Appwrite Functions in parallel with Phase 5

### 8.1 Appwrite Functions (serverless)

- [ ] **P0** Setup Appwrite Functions project + deploy pipeline
- [ ] **P1** Function: validate tournament score submission (prevent tampering)
- [ ] **P1** Function: validate ELO delta before write
- [ ] **P2** Function: tournament completion webhook (notify group members)
- [ ] **P2** Function: subscription status sync (when monetization live)

### 8.2 Security & permissions audit

- [ ] **P0** Review Appwrite collection permissions per role (admin/member/viewer)
- [ ] **P1** Ensure viewers cannot write matches/ratings
- [ ] **P1** Rate limit sensitive endpoints via Appwrite or proxy
- [ ] **P2** Move API keys out of client (only project ID + anon key in apps)

### 8.3 Read optimization

- [ ] **P1** Add `getTournamentSummaries` as default list API (already exists — ensure UI uses it)
- [ ] **P1** Lazy-load full tournament detail on open (not on list)
- [ ] **P2** Appwrite Function: precomputed group leaderboard endpoint
- [ ] **P2** Evaluate dedicated Node/NestJS read API if Appwrite queries exceed 100ms p95

### 8.4 Realtime improvements

- [ ] **P1** Subscribe to group collections (members, invites) — currently fetch-only
- [ ] **P2** Reduce subscription fan-out: subscribe to active tournament only, not all collections
- [ ] **P2** Connection status UI improvements on mobile

### 8.5 Push notifications backend

- [ ] **P2** Store FCM/APNs tokens in new `push_tokens` collection
- [ ] **P2** Function: send push on match scored (for subscribed users)
- [ ] **P3** Notification preferences per user

---

## Phase 9 — Ads & monetization

**Goal:** AdMob ads on mobile, premium feature gates, subscription support.

**Depends on:** Phase 6 or 7 (need store apps); Phase 8.1 for subscription webhooks

### 9.1 Premium feature design

- [ ] **P0** Define free vs premium feature matrix (doc: `docs/monetization-matrix.md`)
- [ ] **P0** Create `feature_entitlements` schema design
- [ ] **P1** Implement client-side feature gate hook `useFeatureEntitlement(featureId)`
- [ ] **P1** Server-side entitlement validation via Appwrite Function

### 9.2 Subscriptions

- [ ] **P1** Integrate RevenueCat (recommended) or Stripe
- [ ] **P1** Paywall UI on mobile (premium templates, advanced analytics, ad-free)
- [ ] **P1** Restore purchases flow (iOS + Android)
- [ ] **P2** Web premium via Stripe (optional)

### 9.3 AdMob (mobile)

- [ ] **P1** Add `react-native-google-mobile-ads`
- [ ] **P1** Banner ads: setup screen, tournament list (non-intrusive placement)
- [ ] **P2** Interstitial ads: between tournament completion and home (frequency cap)
- [ ] **P2** Rewarded ads: unlock premium analytics session (optional)
- [ ] **P2** Respect ad-free entitlement for subscribers

### 9.4 Analytics for monetization

- [ ] **P0** Wire `trackEvent` to chosen provider (PostHog or Firebase)
- [ ] **P1** Funnel: install → register → create tournament → complete → convert
- [ ] **P1** Ad impression/click events
- [ ] **P2** Revenue events from RevenueCat

### 9.5 Sponsorships (future)

- [ ] **P3** Design `advertisements` collection for group-level sponsor banners
- [ ] **P3** Admin UI to upload sponsor logo + link

---

## Phase 10 — Scaling & optimization

**Goal:** Support 100K+ users. Ongoing after core platform launch.

**Depends on:** Production traffic; metrics from Phase 9 analytics

### 10.1 Database & queries

- [ ] **P0** Audit all Appwrite indexes (run query explain / measure fallback scans)
- [ ] **P1** Remove index-missing fallback code paths once indexes confirmed in prod
- [ ] **P1** Paginate tournament history UI (don't load all tournaments at once)
- [ ] **P2** Archive completed tournaments older than N months

### 10.2 Caching

- [ ] **P1** Increase React Query stale times for stable data (ratings, player list)
- [ ] **P2** CDN for player photos (Appwrite Storage CDN or Cloudflare)
- [ ] **P2** Server-side cached leaderboard (Redis or Appwrite Function cache)

### 10.3 Global features

- [ ] **P2** Public tournament pages (read-only, no auth)
- [ ] **P2** Global rankings across groups (requires dedicated API)
- [ ] **P2** Tournament registration + payments
- [ ] **P3** QR check-in for participants

### 10.4 Box Cricket (full implementation)

- [x] **P1** Implement team/squad model in schema
- [x] **P1** Box cricket fixture/scoring in domain package
- [x] **P1** Innings/overs scoring UI (mobile + web)
- [x] **P1** Box Cricket standings calculator
- [x] **P2** E2E tests for box cricket flow
- [x] **P2** Scheduling: ground + time slots ([`box-cricket-scheduling.md`](./box-cricket-scheduling.md))

### 10.5 Infrastructure

- [ ] **P2** Evaluate Appwrite Cloud plan limits vs self-hosted
- [ ] **P2** Dedicated Node API if p95 latency or function limits exceeded
- [ ] **P3** Multi-region if user base international

---

## Suggested batch sizes (what to implement "few at a time")

### Batch A — Quick wins (1 week)

Phase 1.1 + 1.2 + remove zustand + wire hash routing

### Batch B — First extractions (1–2 weeks)

Phase 1.3 first 3 items + Phase 1.6 storage adapter scaffold

### Batch C — Domain start (1–2 weeks)

Phase 2.1 FixtureEngine + Phase 2.2 ScoringEngine (keep backward compat)

### Batch D — Sport foundation (1 week)

Phase 3.1 sport configs + Phase 3.2 `sportId` on schema

### Batch E — Pickleball (1–2 weeks)

Phase 3.3 + 3.4 full pickleball path

### Batch F — Monorepo (2–3 weeks)

Phase 4.1–4.3 — **done** (`apps/web` + `@fixture-maker/domain`)

### Batch G — Mobile MVP (4–6 weeks)

Phase 5.1–5.4 core screens

---

## Task count summary

| Phase | Tasks |
|-------|-------|
| 1 — Tech debt | 42 |
| 2 — Domain | 18 |
| 3 — Multi-sport | 24 |
| 4 — Monorepo | 18 |
| 5 — React Native | 28 |
| 6 — Android | 12 |
| 7 — iOS | 12 |
| 8 — Backend | 17 |
| 9 — Monetization | 18 |
| 10 — Scaling | 17 |
| **Total** | **~206 tasks** |

---

## References

- Architecture assessment: this roadmap's source analysis (June 2026)
- Appwrite migration: [`docs/appwrite-migration.md`](./appwrite-migration.md)
- V2 schema & indexes: [`README.md`](../README.md)
- Key files today:
  - `apps/web/src/App.jsx` — orchestrator
  - `apps/web/vite.config.js` — Vite + Vitest (build output → repo `docs/`)
  - `packages/domain/` — sport plugins + fixture/scoring engines
  - `playwright.config.js` — E2E against `apps/web/e2e`

---

## Notes for implementers

1. **One PR per task group** where possible — e.g. "Extract useFixtureActions" is one PR.
2. **Do not change behavior** during Phase 1–2 — refactor only; tests must stay green.
3. **Badminton stays default** — migrations backfill `sportId: 'badminton'`; sport picker is live.
4. **Phase 4 complete** — start Phase 5 (Expo `apps/mobile/`) using shared packages and `@fixture-maker/storage` native adapter.
5. Update this file checkboxes as you go; add completion dates in commit messages referencing task IDs (e.g. `roadmap: Phase 1.3 theme extraction`).
