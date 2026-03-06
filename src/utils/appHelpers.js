import { updatePlayerRatingsAfterMatch } from './calculations';

export const normalizeTournamentFormat = (value) => (
  value === 'playInFinal' ? 'knockoutByes' : value
);

export const findActiveTournament = (history = []) => {
  if (!Array.isArray(history)) return null;
  return history.find((item) => item?.status === 'active') || null;
};

export const normalizeTemplateTeams = (teamsData = [], templateGameMode = 'doubles', templateNumTeams = 3) => {
  const safeNumTeams = Math.max(3, parseInt(templateNumTeams, 10) || 3);
  return Array.from({ length: safeNumTeams }, (_, index) => {
    const rawTeam = teamsData[index] || {};
    const player1 = rawTeam.player1 || rawTeam.player || '';
    return {
      id: index + 1,
      emoji: rawTeam.emoji || '🏸',
      name: rawTeam.name || '',
      player1,
      player: player1,
      player2: templateGameMode === 'singles' ? '' : (rawTeam.player2 || ''),
    };
  });
};

const normalizeMemberName = (value) => String(value || '').trim().toLowerCase();

const getMemberIdentityKey = (member) => {
  const id = String(member?.id || '').trim();
  if (id) return `id:${id}`;
  const name = normalizeMemberName(member?.name);
  return name ? `name:${name}` : '';
};

const membersMatchIdentity = (left, right) => {
  const leftId = String(left?.id || '').trim();
  const rightId = String(right?.id || '').trim();
  if (leftId && rightId) return leftId === rightId;
  const leftName = normalizeMemberName(left?.name);
  const rightName = normalizeMemberName(right?.name);
  return Boolean(leftName && rightName && leftName === rightName);
};

const hasMemberLink = (member) => Boolean(
  String(member?.linkedAccountId || '').trim()
  || String(member?.linkedEmail || '').trim()
);

const areMemberLinksEqual = (left, right) => (
  String(left?.linkedAccountId || '').trim() === String(right?.linkedAccountId || '').trim()
  && String(left?.linkedEmail || '').trim().toLowerCase() === String(right?.linkedEmail || '').trim().toLowerCase()
);

export const mergeMemberLinks = (incomingMembers = [], baselineMembers = []) => {
  const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
  return (Array.isArray(incomingMembers) ? incomingMembers : []).map((member) => {
    const byId = baseline.find((item) => item.id && member.id && item.id === member.id);
    const byName = baseline.find((item) => (
      (item.name || '').trim().toLowerCase() === (member.name || '').trim().toLowerCase()
    ));
    const source = byId || byName;
    if (!source) return member;
    return {
      ...member,
      linkedAccountId: member.linkedAccountId || source.linkedAccountId,
      linkedEmail: member.linkedEmail || source.linkedEmail,
    };
  });
};

export const mergeMembersForCloudSave = ({
  nextMembers = [],
  baselineMembers = [],
  remoteMembers = [],
} = {}) => {
  const next = Array.isArray(nextMembers) ? nextMembers : [];
  const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
  const remote = Array.isArray(remoteMembers) ? remoteMembers : [];

  const removedKeys = new Set(
    baseline
      .filter((member) => !next.some((candidate) => membersMatchIdentity(candidate, member)))
      .map(getMemberIdentityKey)
      .filter(Boolean)
  );

  const merged = next.map((member) => ({ ...member }));

  remote.forEach((remoteMember) => {
    const remoteKey = getMemberIdentityKey(remoteMember);
    if (!remoteKey) return;

    const index = merged.findIndex((member) => membersMatchIdentity(member, remoteMember));
    if (index === -1) {
      if (removedKeys.has(remoteKey)) return;
      merged.push({ ...remoteMember });
      return;
    }

    const candidate = merged[index];
    if (hasMemberLink(candidate) || !hasMemberLink(remoteMember)) return;

    const baselineMember = baseline.find((member) => membersMatchIdentity(member, candidate)) || null;
    const linkChangedLocally = baselineMember ? !areMemberLinksEqual(candidate, baselineMember) : false;
    if (linkChangedLocally) return;

    merged[index] = {
      ...candidate,
      linkedAccountId: candidate.linkedAccountId || remoteMember.linkedAccountId,
      linkedEmail: candidate.linkedEmail || remoteMember.linkedEmail,
    };
  });

  return merged;
};

export const buildMemberAccountLinks = (membersList = []) => {
  const links = { byId: {}, byName: {} };
  (Array.isArray(membersList) ? membersList : []).forEach((member) => {
    const linkedAccountId = member?.linkedAccountId;
    const linkedEmail = member?.linkedEmail;
    if (!linkedAccountId && !linkedEmail) return;

    const linkValue = {
      linkedAccountId: linkedAccountId || '',
      linkedEmail: linkedEmail || '',
    };
    if (member?.id) links.byId[member.id] = linkValue;
    const normalizedName = (member?.name || '').trim().toLowerCase();
    if (normalizedName) links.byName[normalizedName] = linkValue;
  });
  return links;
};

export const applyMemberAccountLinks = (membersList = [], memberAccountLinks = {}) => {
  const byId = memberAccountLinks?.byId || {};
  const byName = memberAccountLinks?.byName || {};
  return (Array.isArray(membersList) ? membersList : []).map((member) => {
    const normalizedName = (member?.name || '').trim().toLowerCase();
    const linkFromId = member?.id ? byId[member.id] : null;
    const linkFromName = normalizedName ? byName[normalizedName] : null;
    const source = linkFromId || linkFromName || {};
    return {
      ...member,
      linkedAccountId: member?.linkedAccountId || source.linkedAccountId,
      linkedEmail: member?.linkedEmail || source.linkedEmail,
    };
  });
};

export const deriveRatingsFromHistory = ({ history = [], casual = [] } = {}) => {
  const toTimestamp = (value) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeCompletedMatch = (match) => {
    if (!match?.team1 || !match?.team2 || !match?.completed) return null;
    const score1 = Number(match?.score1);
    const score2 = Number(match?.score2);
    if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
    return {
      ...match,
      score1,
      score2,
      completed: true,
    };
  };

  const sortByTimeAscending = (list = []) => [...list].sort((a, b) => {
    const aTime = Math.max(
      toTimestamp(a?.createdAt),
      toTimestamp(a?.updatedAt),
      toTimestamp(a?.date),
    );
    const bTime = Math.max(
      toTimestamp(b?.createdAt),
      toTimestamp(b?.updatedAt),
      toTimestamp(b?.date),
    );
    if (aTime !== bTime) return aTime - bTime;
    return String(a?.id || a?.appwriteId || '').localeCompare(String(b?.id || b?.appwriteId || ''));
  });

  let rebuilt = {};

  sortByTimeAscending(Array.isArray(history) ? history : []).forEach((tournament) => {
    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => {
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
      });

    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => {
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
      });

    const finalMatch = normalizeCompletedMatch(tournament?.finalMatch);
    if (finalMatch) {
      rebuilt = updatePlayerRatingsAfterMatch(rebuilt, finalMatch);
    }
  });

  sortByTimeAscending(Array.isArray(casual) ? casual : [])
    .map(normalizeCompletedMatch)
    .filter(Boolean)
    .forEach((match) => {
      rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
    });

  return rebuilt;
};

export const cloneRatingsSnapshot = (ratings = {}) => (
  JSON.parse(JSON.stringify(ratings && typeof ratings === 'object' ? ratings : {}))
);

export const buildRatingsDelta = (previousRatings = {}, nextRatings = {}) => {
  const previous = previousRatings && typeof previousRatings === 'object' ? previousRatings : {};
  const next = nextRatings && typeof nextRatings === 'object' ? nextRatings : {};
  const changedRatings = {};
  const deletedPlayerNames = [];

  Object.entries(next).forEach(([playerName, snapshot]) => {
    const before = previous[playerName];
    if (JSON.stringify(before || null) === JSON.stringify(snapshot || null)) return;
    changedRatings[playerName] = snapshot;
  });

  Object.keys(previous).forEach((playerName) => {
    if (Object.prototype.hasOwnProperty.call(next, playerName)) return;
    deletedPlayerNames.push(playerName);
  });

  return { changedRatings, deletedPlayerNames };
};

export const getTournamentIdCandidates = (tournament) => Array.from(new Set(
  [tournament?.appwriteId, tournament?.id]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
));

export const matchesTournamentId = (tournament, targetId) => {
  const normalizedTarget = String(targetId || '').trim();
  if (!normalizedTarget) return false;
  return getTournamentIdCandidates(tournament).includes(normalizedTarget);
};

export const upsertTournamentInHistory = (history = [], tournament = null) => {
  if (!tournament) return history;
  const incomingIds = getTournamentIdCandidates(tournament);
  if (incomingIds.length === 0) return [tournament, ...(Array.isArray(history) ? history : [])];
  const list = Array.isArray(history) ? history : [];
  const index = list.findIndex((item) => (
    incomingIds.some((candidateId) => matchesTournamentId(item, candidateId))
  ));
  if (index < 0) return [tournament, ...list];
  return list.map((item, idx) => (idx === index ? tournament : item));
};

export const normalizeTournamentName = (value) => String(value || '').trim().toLowerCase();

export const parseTournamentDateMs = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;

  const normalized = raw
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const secondary = Date.parse(normalized);
  if (Number.isFinite(secondary)) return secondary;

  return null;
};

export const formatTournamentDateLabel = (value, fallback = 'TBA') => {
  const timestamp = parseTournamentDateMs(value);
  if (!Number.isFinite(timestamp)) {
    const raw = String(value || '').trim();
    return raw || fallback;
  }
  return new Date(timestamp).toLocaleString();
};

export const removeTournamentFromList = (
  source = [],
  { targetIds = [], targetName = '', removeActiveByName = false } = {}
) => {
  const list = Array.isArray(source) ? source : [];
  const idSet = new Set(
    (Array.isArray(targetIds) ? targetIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  );
  const normalizedName = normalizeTournamentName(targetName);

  return list.filter((item) => {
    const itemIds = getTournamentIdCandidates(item);
    if (itemIds.some((candidateId) => idSet.has(candidateId))) return false;
    if (
      removeActiveByName
      && normalizedName
      && item?.status === 'active'
      && !item?.champion
      && normalizeTournamentName(item?.name) === normalizedName
    ) {
      return false;
    }
    return true;
  });
};

export const isScheduledTournamentAlreadyStarted = (
  scheduledTournament = null,
  activeTournaments = []
) => {
  if (!scheduledTournament) return false;
  const scheduledIds = getTournamentIdCandidates(scheduledTournament);
  const scheduledName = normalizeTournamentName(scheduledTournament?.name);
  const activeList = Array.isArray(activeTournaments) ? activeTournaments : [];

  return activeList.some((activeTournament) => {
    if (!activeTournament || activeTournament?.status !== 'active' || activeTournament?.champion) {
      return false;
    }

    const activeIds = getTournamentIdCandidates(activeTournament);
    if (
      scheduledIds.length > 0
      && activeIds.some((id) => scheduledIds.includes(id))
    ) {
      return true;
    }

    const activeName = normalizeTournamentName(activeTournament?.name);
    return Boolean(scheduledName && activeName && scheduledName === activeName);
  });
};

export const getTournamentProgressScore = (tournament) => {
  const totalFixtures = Array.isArray(tournament?.fixtures) ? tournament.fixtures.length : 0;
  const totalBracketMatches = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
    .flatMap((round) => (Array.isArray(round) ? round : [])).length;
  const teamCount = Array.isArray(tournament?.teams) ? tournament.teams.length : 0;
  const completedFixtures = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
    .filter((match) => match?.completed).length;
  const completedBracket = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
    .flatMap((round) => (Array.isArray(round) ? round : []))
    .filter((match) => match?.completed).length;
  const championBonus = tournament?.champion ? 10000 : 0;
  const payloadDepth = totalFixtures + totalBracketMatches + teamCount;
  const summaryPenalty = tournament?.isSummary ? -1 : 0;
  return championBonus + (completedFixtures * 10) + (completedBracket * 10) + payloadDepth + summaryPenalty;
};

export const pickPreferredTournament = (primary, secondary) => {
  if (!primary) return secondary || null;
  if (!secondary) return primary;
  return getTournamentProgressScore(secondary) > getTournamentProgressScore(primary)
    ? secondary
    : primary;
};

export const buildTournamentFromLock = (lock) => {
  if (!lock || lock.status !== 'active') return null;
  return {
    id: lock.id || null,
    appwriteId: lock.id || null,
    name: lock.name || 'Live tournament',
    date: lock.updatedAt
      ? new Date(lock.updatedAt).toLocaleDateString()
      : '',
    teams: Array.isArray(lock.teams) ? lock.teams : [],
    fixtures: Array.isArray(lock.fixtures) ? lock.fixtures : [],
    bracket: Array.isArray(lock.bracket) ? lock.bracket : [],
    champion: lock.champion || null,
    aiSummaries: Array.isArray(lock.aiSummaries) ? lock.aiSummaries : [],
    swapHistory: Array.isArray(lock.swapHistory) ? lock.swapHistory : [],
    format: lock.format || '1',
    gameMode: lock.gameMode || 'doubles',
    tournamentFormat: normalizeTournamentFormat(lock.tournamentFormat || 'league'),
    status: 'active',
    _fromLock: true,
  };
};
