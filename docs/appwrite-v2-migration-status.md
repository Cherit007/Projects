# Appwrite V2 Migration Status

Operational checklist for finishing the move off `app_meta` JSON blobs.

## Source of truth today

| Domain | V2 collection(s) | Fallback |
|--------|------------------|----------|
| Tournaments | `v2_tournaments`, `v2_tournament_teams`, `v2_matches` | Legacy tournaments (read-only) |
| Players / ratings | `v2_players`, `v2_ratings_current` | Legacy players/ratings |
| Groups | `groups`, `group_members`, `group_invites`, `group_join_requests` | `groupService` localStorage demo |
| Templates | `tournament_templates` (when env set) | `app_meta.templates` |
| Roster | `group_roster` (when env set) | `app_meta.members` |
| Player photos | `v2_players` metadata (when enabled) | `app_meta.playerPhotos` |

## Code paths

- **Prefer V2:** `appAuxiliaryDataService.js` checks `isTournamentTemplatesCollectionEnabled()`, etc.
- **Meta fallback:** `packages/api/src/app/appDataService.js` when `COLLECTIONS.APP_META` configured.
- **Active tournament cache:** `bfm:appwrite-active-tournament` localStorage (web-only).

## Manual steps (Appwrite console)

1. Ensure attributes on `v2_tournaments`: `sportId` (string), `ruleConfigJson` (string).
2. Optional: `v2_matches.scheduleJson`, `statisticsJson`; `v2_tournament_teams.squadJson`.
3. Create indexes per `README.md` (groupId, legacyTournamentId, etc.).

## Scripts

```bash
# Dry-run sportId backfill
node scripts/migration/backfill-sport-id.mjs

# Apply sportId backfill (requires Appwrite credentials)
node scripts/migration/backfill-sport-id.mjs --apply

# Validate normalized data
node scripts/migration/validate-normalized.mjs

# Migrate group domain off app_meta
npm run migration:groups:dry-run
npm run migration:groups:apply
```

## Exit criteria (Phase 1.7)

- [ ] All production groups on normalized group collections
- [ ] Templates/roster on dedicated collections (env vars set)
- [ ] No writes to `app_meta` except legacy migration tooling
- [ ] `validate-normalized.mjs` clean in CI or manual pre-release check
