import { describe, expect, it } from 'vitest';
import { buildTournamentShareMessage } from '../utils/shareTournament';

describe('buildTournamentShareMessage', () => {
  it('returns null when tournament name is missing', () => {
    expect(buildTournamentShareMessage({ tournament: { teams: [] } })).toBeNull();
  });

  it('builds a share message with tournament details', () => {
    const payload = buildTournamentShareMessage({
      tournament: {
        name: 'Friday Night League',
        tournamentFormat: 'league',
        gameMode: 'doubles',
        date: '2026-06-13',
        teams: [
          { name: 'Team A', player1: 'Alice', player2: 'Bob' },
          { name: 'Team B', player1: 'Carol', player2: 'Dan' },
        ],
        fixtures: [
          {
            round: 1,
            team1: { name: 'Team A', player1: 'Alice', player2: 'Bob' },
            team2: { name: 'Team B', player1: 'Carol', player2: 'Dan' },
          },
        ],
      },
      groupName: 'Club A',
      baseUrl: 'https://example.com/app/',
    });

    expect(payload?.title).toBe('Friday Night League scheduled');
    expect(payload?.message).toContain('Friday Night League');
    expect(payload?.message).toContain('Club A');
    expect(payload?.message).toContain('League Fixtures');
    expect(payload?.appUrl).toBe('https://example.com/app/');
  });
});
