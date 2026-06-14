# Box Cricket — Match & Squad Schema

Design reference for box cricket tournaments in Fixture Maker. Implementation lives in `@fixture-maker/domain` and `@fixture-maker/api`.

## Casual match (box cricket)

When `sportId` is `boxCricket`, **Record Casual Match** opens the squad-based flow:

- Exactly **2 teams** with names and full squads (min 4 players per team)
- **Series format** on setup: single game, best of 3, or best of 5
- Saved to V2 matches as `matchKind: 'casual'` with `statisticsJson` when provided
- ELO is not applied (team sport)

### Casual series statistics

For multi-game series, `statistics` uses `format: 'casualSeries'`:

```json
{
  "sportId": "boxCricket",
  "format": "casualSeries",
  "series": {
    "format": "bo3",
    "label": "Best of 3",
    "winsRequired": 2,
    "maxGames": 3,
    "team1Wins": 2,
    "team2Wins": 1,
    "winnerTeamId": 1,
    "games": [
      {
        "gameNo": 1,
        "score1": 42,
        "score2": 38,
        "winnerTeamId": 1,
        "statistics": { "innings": [], "result": {} }
      }
    ]
  }
}
```

- Single game: `match.score1` / `score2` are **runs**; series wins are still in `series.games[0]`
- Best of 3/5: `match.score1` / `score2` are **series wins** (e.g. 2–1)

Domain helpers: `CASUAL_SERIES_FORMATS`, `isCasualSeriesComplete`, `buildCasualSeriesStatistics` in `boxCricketScoring.js`.

## Scoring modes

| Mode | UI | Stored on `statistics` |
|------|-----|------------------------|
| **Summary** | Runs, wickets, overs per innings | `scoringMode: 'summary'` |
| **Ball by ball** | Striker / non-striker + per-ball pad (0–6, W, WD, NB) | `scoringMode: 'ballByBall'`, `innings[].ballLog[]` |

Ball log entry shape: `{ over, ballInOver, kind, runs, strikerId, nonStrikerId, dismissedPlayerId? }`.

Domain helpers: `packages/domain/src/sports/boxCricket/ballByBallScoring.js`.

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
