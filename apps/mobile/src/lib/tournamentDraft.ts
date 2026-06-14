import { getSport, getSportPlugin } from '@fixture-maker/domain/sports';
import type { FixtureMatch, TeamDraft, TournamentDraft } from '../types/tournament';

export const createLocalTournamentId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createEmptyTeams = (
  numTeams: number,
  gameMode: string,
  sportId: string,
): TeamDraft[] => {
  const sport = getSport(sportId);
  const emoji = sport.icon || '🏸';
  return Array.from({ length: numTeams }, (_, index) => ({
    id: index + 1,
    name: '',
    emoji,
    player1: '',
    player2: '',
    ...(gameMode === 'singles' ? { player: '' } : {}),
  }));
};

export const validateTeamsForStart = (teams: TeamDraft[], gameMode: string) => {
  if (!teams.length) {
    return { valid: false, message: 'Add at least one team.' };
  }

  for (const team of teams) {
    if (!team.name?.trim()) {
      return { valid: false, message: 'Every team needs a name.' };
    }
    const player1 = (team.player1 || team.player || '').trim();
    if (!player1) {
      return { valid: false, message: 'Every team needs at least one player.' };
    }
    if (gameMode !== 'singles' && !team.player2?.trim()) {
      return { valid: false, message: 'Doubles teams need two players.' };
    }
  }

  return { valid: true };
};

export const generateLeagueFixtures = (
  teams: TeamDraft[],
  sportId: string,
  tournamentFormat: string,
  format: string,
) => {
  const plugin = getSportPlugin(sportId);
  const result = plugin.fixture.generateFixturesByFormat(teams, {
    tournamentFormat,
    format,
  });

  if (result.kind === 'league') {
    return {
      fixtures: (result.fixtures || []) as FixtureMatch[],
      bracket: [] as FixtureMatch[][],
    };
  }

  return {
    fixtures: [],
    bracket: (result.bracket || []) as FixtureMatch[][],
  };
};

export const buildActiveSnapshot = (draft: TournamentDraft): TournamentDraft => ({
  ...draft,
  updatedAt: new Date().toISOString(),
});

export const normalizeScore = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? '' : parsed;
};

export const applyMatchScore = (
  fixtures: FixtureMatch[],
  matchId: string | number,
  score1: number,
  score2: number,
) => fixtures.map((match) => (
  match.id === matchId
    ? { ...match, score1, score2, completed: true }
    : match
));

export const findNextOpenFixture = (fixtures: FixtureMatch[]) => (
  fixtures.find((match) => !match.completed && match.team1 && match.team2) || null
);
