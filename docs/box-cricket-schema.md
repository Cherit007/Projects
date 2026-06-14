# Box Cricket — Match & Squad Schema

Design reference for box cricket tournaments in Fixture Maker. Implementation lives in `@fixture-maker/domain` and `@fixture-maker/api`.

## Team / squad model

| Field | Type | Notes |
|-------|------|-------|
| `participantModel` | `'squad'` | From `boxCricket.config.js` |
| `squad` | `Array<{ name, role? }>` | Optional per-player slots; persisted as `squadJson` on teams |
| `player1`, `player2` | string | Legacy pair fields; synced from squad for compatibility |

## Match result shape (innings)

Stored on fixture `statistics` / `statisticsJson`:

```json
{
  "innings1": { "runs": 42, "wickets": 3, "overs": 6, "rawRuns": 40 },
  "innings2": { "runs": 38, "wickets": 5, "overs": 6 },
  "superOver": false,
  "winnerTeamId": 1
}
```

Super-over innings use `phase: 'superOver'` internally when tied and `superOverEnabled` in `ruleConfig`.

## Rule config (`ruleConfigJson` on tournament)

| Key | Default | Purpose |
|-----|---------|---------|
| `oversLimit` | 6 | Overs per innings |
| `maxWickets` | 10 | Wicket cap |
| `powerplayOvers` | 0 | Powerplay multiplier window |
| `bonusRunsPerWicket` | 0 | Bonus runs per wicket taken |
| `lastManStanding` | false | LMS wicket cap logic |
| `superOverEnabled` | true | Tie-break super over |
| `ballType` | `standard` | `standard` \| `tennis` |

## Standings

Points table uses NRR (net run rate) tie-break via `BoxCricketRankingEngine`. League wins award `pointsPerWin` (default 2).

## Appwrite (optional attrs)

| Collection | Field | Purpose |
|------------|-------|---------|
| `v2_tournaments` | `sportId`, `ruleConfigJson` | Sport + rules |
| `v2_tournament_teams` | `squadJson` | Squad roster |
| `v2_matches` | `statisticsJson`, `scheduleJson` | Innings stats + ground/time |

## Related docs

- Scheduling: [`box-cricket-scheduling.md`](./box-cricket-scheduling.md)
- Plugin: `packages/domain/src/sports/boxCricket/`
