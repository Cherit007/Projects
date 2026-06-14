# Box Cricket — Ground Allocation & Time Slots

Design for Phase **3.9**: assign grounds and time windows to fixtures, detect conflicts, and persist schedule data on matches.

## Data model

Each fixture may carry an optional `schedule` object (also serializable as `scheduleJson` for Appwrite):

| Field | Type | Notes |
|-------|------|-------|
| `groundId` | string | Stable slug derived from label (e.g. `court-a`) |
| `groundLabel` | string | Display name shown in UI |
| `startAt` | ISO 8601 | Slot start |
| `endAt` | ISO 8601 | Slot end (optional; defaults to start for overlap checks) |

Helpers live in `@fixture-maker/domain/fixture/matchSchedule`:

- `normalizeMatchSchedule` — trim/validate shape
- `serializeMatchSchedule` / `parseMatchScheduleJson` — persistence
- `findScheduleConflicts` — same ground + overlapping window
- `formatMatchScheduleLabel` — compact display string

## UI

`MatchSchedulePanel` on the **Fixtures** tab lets organizers set ground label, start, and end. Conflicts surface inline before save.

`updateMatchSchedule(matchId, schedule)` in `useScoringActions` writes `schedule` on the in-memory fixture and persists with the tournament snapshot.

## Conflict rules

1. Both matches must share the same `groundId` or `groundLabel` (case-insensitive).
2. Both must have a parseable `startAt`.
3. Intervals `[startAt, endAt]` overlap → conflict listed with opposing match label.

Saving is allowed even when conflicts exist (organizer override); the panel warns only.

## Future (Appwrite)

Optional attribute `v2_matches.scheduleJson` (string) for per-match schedule when matches are stored separately. Until then, schedule rides on the tournament fixtures blob like other match fields.

## Tests

`src/test/matchSchedule.unit.test.js` — normalize/serialize and overlap detection.
