import { describe, expect, it } from 'vitest';
import { buildPlayerStatsBySport, resolveDefaultPlayerSportId, listSportsWithPlayerActivity } from '../utils/playerSportStats';

describe('playerSportStats', () => {
  const boxCricketMatch = {
    sportId: 'boxCricket',
    completed: true,
    winner: 'team1',
    team1: {
      id: 1,
      name: 'Aces',
      squad: [{ id: 'p1', name: 'Alex' }],
    },
    team2: {
      id: 2,
      name: 'Blaze',
      squad: [{ id: 'p9', name: 'Chris' }],
    },
    score1: 10,
    score2: 4,
    statistics: {
      sportId: 'boxCricket',
      teams: {
        team1: { id: 1, squad: [{ id: 'p1', name: 'Alex' }] },
        team2: { id: 2, squad: [{ id: 'p9', name: 'Chris' }] },
      },
      series: {
        winnerTeamId: 1,
        games: [{
          statistics: {
            sportId: 'boxCricket',
            scoringMode: 'ballByBall',
            oversLimit: 6,
            innings: [
              {
                battingTeamId: 1,
                bowlingTeamId: 2,
                runs: 10,
                wickets: 0,
                overs: 1,
                ballLog: [{ kind: 'runs', runs: 10, strikerId: 'p1', bowlerId: 'p9' }],
              },
              {
                battingTeamId: 2,
                bowlingTeamId: 1,
                runs: 4,
                wickets: 0,
                overs: 1,
                ballLog: [{ kind: 'runs', runs: 4, strikerId: 'p9', bowlerId: 'p1' }],
              },
            ],
            result: { winnerTeamId: 1 },
          },
        }],
      },
    },
  };

  it('returns box cricket runs for a squad player', () => {
    const bySport = buildPlayerStatsBySport({
      playerName: 'Alex',
      tournamentHistory: [],
      casualMatches: [boxCricketMatch],
    });

    expect(bySport.boxCricket.stats).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 1,
      cricketRuns: 10,
    });
    expect(bySport.badminton.stats).toBeNull();
  });

  it('does not expose pickleball stats when the player never played it', () => {
    const bySport = buildPlayerStatsBySport({
      playerName: 'Alex',
      tournamentHistory: [],
      casualMatches: [boxCricketMatch],
    });

    expect(listSportsWithPlayerActivity(bySport).map((sport) => sport.id)).toEqual(['boxCricket']);
    expect(bySport.pickleball.stats).toBeNull();
  });

  it('defaults sport selection to the active context sport', () => {
    const bySport = buildPlayerStatsBySport({
      playerName: 'Alex',
      tournamentHistory: [],
      casualMatches: [boxCricketMatch],
    });

    expect(resolveDefaultPlayerSportId({
      defaultSportId: 'boxCricket',
      statsBySport: bySport,
    })).toBe('boxCricket');
  });
});
