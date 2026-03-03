# Badminton Fixture Maker

React + Vite app for badminton tournament management, casual match tracking, ELO ratings, and Appwrite sync.

## PWA Support

This app is now configured as a Progressive Web App (PWA):

- `manifest.webmanifest` for install metadata
- Service worker (`public/sw.js`) for app-shell/offline caching
- Install icons in `public/` (`192x192`, `512x512`, maskable, apple touch icon)
- Standalone mode support on mobile/desktop after "Add to Home Screen"
- In-app install button when browser exposes `beforeinstallprompt`
- In-app update banner when a new service worker is available
- Offline indicator badge when network is unavailable
- iOS startup splash images (`public/startup/*.png`) via `apple-touch-startup-image` links
- Offline write outbox (queued cloud writes auto-sync when internet returns)
- Optional local notifications for outbox sync completion (when user grants permission)

Notes:

- Offline mode covers app shell and static assets after first successful load.
- Live Appwrite reads/writes still need internet.
- Service worker is registered only in production builds.
- iOS does not support Background Sync API, so queue flush falls back to `online` and app foreground events.

## Migration Docs

- Appwrite migration runbook: [`docs/appwrite-migration.md`](docs/appwrite-migration.md)
- Backfill script source of truth: [`scripts/migration/backfill-normalized.mjs`](scripts/migration/backfill-normalized.mjs)

## New V2 Appwrite Collections and Columns

The migration writes to these normalized V2 collections.

### 1) `APPWRITE_COLLECTION_V2_PLAYERS`

Columns:

- `groupId`
- `displayName`
- `normalizedName`
- `source`
- `migratedAt`

### 2) `APPWRITE_COLLECTION_V2_TOURNAMENTS`

Columns:

- `groupId`
- `legacyTournamentId`
- `name`
- `dateLabel`
- `status`
- `gameMode`
- `tournamentFormat`
- `format`
- `oddPlayerEnabled`
- `oddPlayerName`
- `oddPlayerId`
- `sourceCreatedAt`
- `sourceUpdatedAt`
- `migratedAt`

### 3) `APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS`

Columns:

- `groupId`
- `tournamentId`
- `legacyTournamentId`
- `legacyTeamId`
- `teamNo`
- `teamName`
- `emoji`
- `player1Name`
- `player1Id`
- `player2Name`
- `player2Id`
- `migratedAt`

### 4) `APPWRITE_COLLECTION_V2_MATCHES`

Columns:

- `groupId`
- `tournamentId`
- `legacyTournamentId`
- `legacyMatchId`
- `matchKind`
- `roundLabel`
- `roundNo`
- `sequenceNo`
- `bracketRoundIndex`
- `bracketMatchIndex`
- `nextLegacyMatchId`
- `team1Id`
- `team2Id`
- `team1Name`
- `team2Name`
- `score1`
- `score2`
- `completed`
- `winnerSide`
- `sourceCreatedAt`
- `migratedAt`

### 5) `APPWRITE_COLLECTION_V2_MATCH_PLAYERS`

Columns:

- `groupId`
- `matchId`
- `sideNo`
- `slotNo`
- `playerName`
- `playerId`
- `sourceCreatedAt`
- `migratedAt`

### 6) `APPWRITE_COLLECTION_V2_RATINGS_CURRENT`

Columns:

- `groupId`
- `playerId`
- `playerName`
- `rating`
- `matchesPlayed`
- `lastResult`
- `lastChange`
- `sourceUpdatedAt`
- `migratedAt`

## Notes

- Keep legacy collections unchanged until migration validation passes.
- Use backup and validation steps from `docs/appwrite-migration.md` before cutover.

## Appwrite Function

No Appwrite Function is used by the current app flow.
All reads/writes use direct Appwrite database APIs from the client.

## Required V2 Indexes

Create these indexes in Appwrite to avoid query fallback scans and keep heavy actions fast.

### `APPWRITE_COLLECTION_V2_PLAYERS`

- Key index: `groupId`
- Key index: `normalizedName`
- Composite unique index: `groupId + normalizedName`

### `APPWRITE_COLLECTION_V2_RATINGS_CURRENT`

- Key index: `groupId`
- Key index: `playerId`
- Key index: `playerName`
- Composite unique index: `groupId + playerId`
- Composite key index: `groupId + playerName`

### `APPWRITE_COLLECTION_V2_TOURNAMENTS`

- Key index: `groupId`
- Key index: `status`
- Composite key index: `groupId + status`

### `APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS`

- Key index: `groupId`
- Key index: `tournamentId`
- Composite unique index: `groupId + tournamentId + legacyTeamId`

### `APPWRITE_COLLECTION_V2_MATCHES`

- Key index: `groupId`
- Key index: `tournamentId`
- Composite key index: `groupId + tournamentId`
- Composite unique index: `groupId + tournamentId + matchKind + legacyMatchId + bracketRoundIndex + bracketMatchIndex`

### `APPWRITE_COLLECTION_V2_MATCH_PLAYERS`

- Key index: `groupId`
- Key index: `matchId`
- Composite key index: `groupId + matchId`
- Composite unique index: `groupId + matchId + sideNo + slotNo`
