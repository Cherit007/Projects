import { boxCricketSport } from '../boxCricket.config.js';

export const getSquadLimits = (sportConfig = boxCricketSport) => ({
  minPlayers: Number(sportConfig?.squad?.minPlayers) || 4,
  maxPlayers: Number(sportConfig?.squad?.maxPlayers) || 11,
  defaultSlots: Number(sportConfig?.squad?.defaultSlots) || 6,
});

export const createSquadPlayer = (name = '', role = 'player') => ({
  id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: String(name || '').trim(),
  role,
});

/** @param {number} teamIndex @returns {Object} */
export const createEmptySquadTeam = (teamIndex, sportConfig = boxCricketSport) => {
  const { defaultSlots } = getSquadLimits(sportConfig);
  const squad = Array.from({ length: defaultSlots }, (_, index) => (
    createSquadPlayer('', index === 0 ? 'captain' : 'player')
  ));
  return {
    id: teamIndex,
    emoji: '🏏',
    name: '',
    squad,
    player1: '',
    player2: '',
  };
};

export const normalizeSquad = (squadInput) => {
  const source = Array.isArray(squadInput)
    ? squadInput
    : Array.isArray(squadInput?.players)
      ? squadInput.players
      : [];
  return source
    .map((entry, index) => ({
      id: String(entry?.id || `p-${index + 1}`),
      name: String(entry?.name || '').trim(),
      role: entry?.role === 'captain' ? 'captain' : 'player',
    }))
    .filter((entry) => entry.name);
};

export const serializeSquad = (squadInput) => {
  const players = normalizeSquad(squadInput);
  if (players.length === 0) return '';
  return JSON.stringify({ players });
};

export const parseSquadJson = (squadJson) => {
  if (!squadJson) return [];
  if (Array.isArray(squadJson)) return normalizeSquad(squadJson);
  if (typeof squadJson === 'object') return normalizeSquad(squadJson);
  if (typeof squadJson !== 'string') return [];
  try {
    const parsed = JSON.parse(squadJson);
    return normalizeSquad(parsed);
  } catch {
    return [];
  }
};

export const syncLegacyPlayersFromSquad = (team) => {
  const rawSquad = Array.isArray(team?.squad) ? team.squad : [];
  const namedSquad = normalizeSquad(rawSquad.length ? rawSquad : team?.squad);
  const captain = namedSquad.find((player) => player.role === 'captain') || namedSquad[0];
  const second = namedSquad.find((player) => player.name && player.name !== captain?.name) || namedSquad[1];
  return {
    ...team,
    squad: rawSquad.length ? rawSquad : namedSquad,
    player1: captain?.name || '',
    player: captain?.name || '',
    player2: second?.name || '',
  };
};

export const isSquadTeamValid = (team, sportConfig = boxCricketSport) => {
  const { minPlayers } = getSquadLimits(sportConfig);
  const squad = normalizeSquad(team?.squad);
  return Boolean(String(team?.name || '').trim()) && squad.length >= minPlayers;
};

export const listSquadPlayerNames = (team) => (
  normalizeSquad(team?.squad).map((player) => player.name).filter(Boolean)
);
