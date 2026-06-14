import { STORAGE_KEYS } from '@fixture-maker/storage/storageKeys';

const isBrowser = () => typeof window !== 'undefined';

export const createBoxCricketCasualDraft = ({
  step = 'teams',
  teams = [],
  toss = { tossWinnerTeamId: null, electedTo: null },
  scoringMode = 'summary',
  seriesFormat = 'single',
  ruleConfig = null,
  seriesGames = [],
  team1Wins = 0,
  team2Wins = 0,
  gameNumber = 1,
  scorerEpoch = 0,
  scorer = null,
} = {}) => ({
  id: `casual-draft-${Date.now()}`,
  sportId: 'boxCricket',
  type: 'casual',
  status: 'live',
  updatedAt: new Date().toISOString(),
  step,
  teams,
  toss,
  scoringMode,
  seriesFormat,
  ruleConfig,
  seriesGames,
  team1Wins,
  team2Wins,
  gameNumber,
  scorerEpoch,
  scorer,
});

export const readBoxCricketCasualDraft = (storage) => {
  if (!storage) return null;
  try {
    const raw = storage.getJson(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT, null);
    if (!raw || raw.sportId !== 'boxCricket' || raw.status !== 'live') return null;
    return raw;
  } catch {
    return null;
  }
};

export const writeBoxCricketCasualDraft = (storage, draft, queueWrite) => {
  if (!storage || !draft) return;
  const payload = {
    ...draft,
    sportId: 'boxCricket',
    status: 'live',
    updatedAt: new Date().toISOString(),
  };
  if (typeof queueWrite === 'function') {
    queueWrite(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT, payload);
    return;
  }
  storage.setJson(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT, payload);
};

export const clearBoxCricketCasualDraft = (storage, queueWrite) => {
  if (!storage) return;
  if (typeof queueWrite === 'function') {
    queueWrite(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT, null);
    return;
  }
  storage.removeItem(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT);
};

export const buildCasualDraftLiveCard = (draft) => {
  if (!draft?.teams?.length) return null;
  const [team1, team2] = draft.teams;
  const oversLimit = Number(draft?.ruleConfig?.oversLimit) || 6;
  const label = draft.step === 'score'
    ? `${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'} · scoring`
    : `${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'} · setup`;
  return {
    id: draft.id || 'casual-draft',
    kind: 'casualDraft',
    name: label,
    sportId: 'boxCricket',
    sportIcon: '🏏',
    sportLabel: 'Box Cricket',
    subtitle: `${oversLimit}-over casual match`,
    phaseLabel: draft.step === 'score' ? `Live · ${oversLimit} overs` : 'Resume setup',
    currentMatchLabel: label,
    completedCount: 0,
    totalCount: 1,
    draft,
  };
};

export const readBoxCricketCasualDraftFromBrowser = () => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.ACTIVE_CASUAL_MATCH_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.sportId !== 'boxCricket' || parsed.status !== 'live') return null;
    return parsed;
  } catch {
    return null;
  }
};
