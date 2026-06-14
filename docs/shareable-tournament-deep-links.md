# Shareable Tournament Deep Links

Design for opening a specific tournament or screen via URL hash + query params (web PWA today; mobile deep links in Phase 5).

## Current hash routes

| Hash | Screen |
|------|--------|
| `#/auth` | Login / register |
| `#/groups` | Group hub |
| `#/viewer` | Guest viewer mode |
| `#/setup` | Home / tournament setup |
| `#/teams` | Team entry |
| `#/live` | Active tournament view |

Implemented in `apps/web/src/hooks/useHashAppRoute.js` and synced from `appStore.step`.

## Proposed tournament deep link

```
https://Cherit007.github.io/Projects/#/live?tournamentId=<id>&groupId=<groupId>
```

| Param | Required | Behavior |
|-------|----------|----------|
| `tournamentId` | yes | Appwrite doc id or legacy local id — resolved via `getTournamentIdCandidates` |
| `groupId` | recommended | Scope bootstrap to group; omit only for single-group demos |
| `tab` | no | `fixtures` \| `table` \| `stats` \| `reports` — default `fixtures` |

## Load sequence

1. Parse hash route + `URLSearchParams` on boot (`useHashAppRoute` extension).
2. If user authenticated and `groupId` present → set active group, fetch tournament detail via `tournamentService.getTournamentById`.
3. Hydrate `appStore` step to `live`, set `currentTournamentId`, restore fixtures from cloud or history cache.
4. If tournament missing or viewer lacks access → toast + redirect `#/setup`.

## Share UX (future)

- **Copy link** button on tournament header (admin/member only).
- **WhatsApp** uses existing `shareTournament.js` with deep link appended.
- **QR** optional — encode full URL for court-side access.

## Mobile (Phase 5)

Mirror query keys under `fixturemaker://tournament/<id>?groupId=...` and map to React Navigation stack `Tournament`.

## Security

- Viewers: read-only tournament payload only if group allows viewer role.
- Never embed tokens in URLs; rely on existing Appwrite session.
- Validate `groupId` matches tournament document before hydrate.
