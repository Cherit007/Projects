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
    const fallbackCompletedAt = tournament?.createdAt || tournament?.date || tournament?.updatedAt || null;
    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => {
        const matchWithDate = match?.completedAt
          ? match
          : { ...match, completedAt: fallbackCompletedAt };
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
      });

    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => {
        const matchWithDate = match?.completedAt
          ? match
          : { ...match, completedAt: fallbackCompletedAt };
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
      });

    const finalMatch = normalizeCompletedMatch(tournament?.finalMatch);
    if (finalMatch) {
      const matchWithDate = finalMatch?.completedAt
        ? finalMatch
        : { ...finalMatch, completedAt: fallbackCompletedAt };
      rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
    }
  });

  sortByTimeAscending(Array.isArray(casual) ? casual : [])
    .map(normalizeCompletedMatch)
    .filter(Boolean)
    .forEach((match) => {
      const fallbackCompletedAt = match?.completedAt
        || match?.date
        || match?.createdAt
        || match?.updatedAt
        || null;
      const matchWithDate = match?.completedAt
        ? match
        : { ...match, completedAt: fallbackCompletedAt };
      rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
    });

  return rebuilt;
};

const prefersDayFirst = (() => {
  try {
    const sample = new Intl.DateTimeFormat().formatToParts(new Date(2000, 0, 2));
    const order = sample
      .filter((part) => part.type === 'day' || part.type === 'month')
      .map((part) => part.type);
    return order[0] === 'day';
  } catch {
    return false;
  }
})();

const parseLooseDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return null;
  let month = first;
  let day = second;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else if (prefersDayFirst) {
    day = first;
    month = second;
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizeCompletedAtValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return parseLooseDate(value);
};

const backfillCompletedAtForMatch = (match, fallbackCompletedAt) => {
  if (!match || match.completed !== true) return match;
  if (match.completedAt) return match;
  const completedAt = normalizeCompletedAtValue(match?.date) || fallbackCompletedAt || null;
  if (!completedAt) return match;
  return { ...match, completedAt };
};

export const backfillTournamentHistoryCompletedAt = (history = []) => {
  const list = Array.isArray(history) ? history : [];
  let changed = false;
  const next = list.map((tournament) => {
    if (!tournament || typeof tournament !== 'object') return tournament;
    const fallbackCompletedAt = normalizeCompletedAtValue(
      tournament?.date || tournament?.createdAt || tournament?.updatedAt || null
    );
    let updated = false;

    const fixtures = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : []).map((match) => {
      const nextMatch = backfillCompletedAtForMatch(match, fallbackCompletedAt);
      if (nextMatch !== match) updated = true;
      return nextMatch;
    });

    const bracket = (Array.isArray(tournament?.bracket) ? tournament.bracket : []).map((round) => {
      if (!Array.isArray(round)) return round;
      let roundUpdated = false;
      const nextRound = round.map((match) => {
        const nextMatch = backfillCompletedAtForMatch(match, fallbackCompletedAt);
        if (nextMatch !== match) roundUpdated = true;
        return nextMatch;
      });
      if (roundUpdated) updated = true;
      return roundUpdated ? nextRound : round;
    });

    const finalMatch = backfillCompletedAtForMatch(tournament?.finalMatch, fallbackCompletedAt);
    if (finalMatch !== tournament?.finalMatch) updated = true;

    if (!updated) return tournament;
    changed = true;
    return {
      ...tournament,
      fixtures,
      bracket,
      finalMatch,
    };
  });

  return { history: next, changed };
};

export const backfillCasualMatchesCompletedAt = (casualMatches = []) => {
  const list = Array.isArray(casualMatches) ? casualMatches : [];
  let changed = false;
  const next = list.map((match) => {
    if (!match || match.completed === false || match.completedAt) return match;
    const fallbackCompletedAt = normalizeCompletedAtValue(
      match?.date || match?.createdAt || match?.updatedAt || null
    );
    if (!fallbackCompletedAt) return match;
    changed = true;
    return { ...match, completedAt: fallbackCompletedAt };
  });

  return { matches: next, changed };
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
  [tournament?.appwriteId, tournament?.id, tournament?.legacyTournamentId]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
));

export const matchesTournamentId = (tournament, targetId) => {
  const normalizedTarget = String(targetId || '').trim();
  if (!normalizedTarget) return false;
  return getTournamentIdCandidates(tournament).includes(normalizedTarget);
};

export const upsertTournamentInHistory = (history = [], tournament = null) => {
  const list = Array.isArray(history) ? history : [];
  const next = tournament ? [tournament, ...list] : list;
  return sortTournamentHistoryByRecent(dedupeTournamentHistory(next));
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

  const scrubbed = raw.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  const scrubbedDirect = Date.parse(scrubbed);
  if (Number.isFinite(scrubbedDirect)) return scrubbedDirect;

  const normalized = raw
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const secondary = Date.parse(normalized);
  if (Number.isFinite(secondary)) return secondary;

  const normalizedScrubbed = scrubbed
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tertiary = Date.parse(normalizedScrubbed);
  if (Number.isFinite(tertiary)) return tertiary;

  return null;
};

export const sortTournamentHistoryByRecent = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const toMs = (value) => {
    const parsed = parseTournamentDateMs(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const toFallbackMs = (item) => {
    const updated = Date.parse(String(item?.updatedAt || ''));
    if (Number.isFinite(updated)) return updated;
    const created = Date.parse(String(item?.createdAt || ''));
    if (Number.isFinite(created)) return created;
    return 0;
  };
  const toSortMs = (item) => {
    const dateMs = toMs(item?.dateLabel || item?.date);
    if (Number.isFinite(dateMs)) return dateMs;
    const created = Date.parse(String(item?.createdAt || ''));
    if (Number.isFinite(created)) return created;
    return 0;
  };

  return [...list].sort((a, b) => {
    const aTime = toSortMs(a);
    const bTime = toSortMs(b);
    if (aTime !== bTime) return bTime - aTime;
    const aFallback = toFallbackMs(a);
    const bFallback = toFallbackMs(b);
    if (aFallback !== bFallback) return bFallback - aFallback;
    const aId = String(a?.id || a?.appwriteId || a?.legacyTournamentId || '');
    const bId = String(b?.id || b?.appwriteId || b?.legacyTournamentId || '');
    return bId.localeCompare(aId);
  });
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
      && itemIds.length === 0
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
  const primaryScore = getTournamentProgressScore(primary);
  const secondaryScore = getTournamentProgressScore(secondary);
  if (secondaryScore > primaryScore) return secondary;
  if (secondaryScore < primaryScore) return primary;

  const primaryAppwriteId = String(primary?.appwriteId || '').trim();
  const secondaryAppwriteId = String(secondary?.appwriteId || '').trim();
  if (!primaryAppwriteId && secondaryAppwriteId) return secondary;
  if (primaryAppwriteId && !secondaryAppwriteId) return primary;

  if (primary?.isSummary && !secondary?.isSummary) return secondary;
  if (!primary?.isSummary && secondary?.isSummary) return primary;

  return primary;
};

const getTournamentTeamsCount = (tournament) => {
  if (Array.isArray(tournament?.teams)) return tournament.teams.length;
  const count = Number(tournament?.teamsCount);
  return Number.isFinite(count) ? count : 0;
};

const getTournamentTeamSignature = (tournament) => {
  const teams = Array.isArray(tournament?.teams) ? tournament.teams : [];
  if (teams.length === 0) return '';
  return teams
    .map((team) => {
      const name = normalizeTournamentName(team?.name);
      const player1 = normalizeTournamentName(team?.player || team?.player1);
      const player2 = normalizeTournamentName(team?.player2);
      return `${name}|${player1}|${player2}`;
    })
    .sort()
    .join('||');
};

const getTournamentAppwriteId = (tournament) => String(tournament?.appwriteId || '').trim();
const getTournamentLegacyId = (tournament) => String(tournament?.legacyTournamentId || '').trim();
const isLocalTournamentId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (/^\d{10,}$/.test(normalized)) return true;
  return normalized.startsWith('sched-local-') || normalized.startsWith('local-');
};
const getTournamentStableId = (tournament) => (
  getTournamentAppwriteId(tournament)
  || getTournamentLegacyId(tournament)
  || (isLocalTournamentId(tournament?.id) ? String(tournament?.id || '').trim() : '')
);

const getTournamentMatchPayloadCount = (tournament) => {
  const fixtureCount = Array.isArray(tournament?.fixtures) ? tournament.fixtures.length : 0;
  const bracketCount = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
    .reduce((sum, round) => sum + (Array.isArray(round) ? round.length : 0), 0);
  const finalCount = tournament?.finalMatch ? 1 : 0;
  return fixtureCount + bracketCount + finalCount;
};

const cloneDeep = (value) => {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const cloneTournamentRecord = (item = {}) => ({
  ...(item && typeof item === 'object' ? item : {}),
  teams: cloneDeep(Array.isArray(item?.teams) ? item.teams : []),
  fixtures: cloneDeep(Array.isArray(item?.fixtures) ? item.fixtures : []),
  bracket: cloneDeep(Array.isArray(item?.bracket) ? item.bracket : []),
  finalMatch: cloneDeep(item?.finalMatch || null),
  champion: cloneDeep(item?.champion || null),
  aiSummaries: cloneDeep(Array.isArray(item?.aiSummaries) ? item.aiSummaries : []),
  swapHistory: cloneDeep(Array.isArray(item?.swapHistory) ? item.swapHistory : []),
});

const isSameCalendarDay = (left, right) => {
  const leftMs = parseTournamentDateMs(left?.date);
  const rightMs = parseTournamentDateMs(right?.date);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
  return new Date(leftMs).toDateString() === new Date(rightMs).toDateString();
};

const isLikelySameLiveTournament = (left, right) => {
  if (!left || !right) return false;

  const leftIds = getTournamentIdCandidates(left);
  const rightIds = getTournamentIdCandidates(right);
  if (leftIds.some((id) => rightIds.includes(id))) return true;

  const leftName = normalizeTournamentName(left?.name);
  const rightName = normalizeTournamentName(right?.name);
  if (!leftName || leftName !== rightName) return false;

  const leftFormat = normalizeTournamentFormat(left?.tournamentFormat || left?.format || 'league');
  const rightFormat = normalizeTournamentFormat(right?.tournamentFormat || right?.format || 'league');
  if (leftFormat !== rightFormat) return false;

  const leftTeams = getTournamentTeamsCount(left);
  const rightTeams = getTournamentTeamsCount(right);
  if (leftTeams > 0 && rightTeams > 0 && leftTeams !== rightTeams) return false;

  const leftTeamSignature = getTournamentTeamSignature(left);
  const rightTeamSignature = getTournamentTeamSignature(right);
  if (leftTeamSignature && rightTeamSignature && leftTeamSignature !== rightTeamSignature) return false;

  const leftMatches = getTournamentMatchPayloadCount(left);
  const rightMatches = getTournamentMatchPayloadCount(right);

  const leftStableId = getTournamentStableId(left);
  const rightStableId = getTournamentStableId(right);
  const leftHasStableId = Boolean(leftStableId);
  const rightHasStableId = Boolean(rightStableId);
  const leftIsUnstableIdentity = !leftHasStableId || Boolean(left?._fromLock || left?.isSummary);
  const rightIsUnstableIdentity = !rightHasStableId || Boolean(right?._fromLock || right?.isSummary);

  if (leftHasStableId && rightHasStableId && leftStableId !== rightStableId) {
    const hasTeamSignatureMatch = Boolean(
      leftTeamSignature && rightTeamSignature && leftTeamSignature === rightTeamSignature
    );
    if (!hasTeamSignatureMatch && !leftIsUnstableIdentity && !rightIsUnstableIdentity) {
      return false;
    }
  }

  if (isSameCalendarDay(left, right)) return true;

  if (leftMatches === 0 || rightMatches === 0) {
    return leftIsUnstableIdentity || rightIsUnstableIdentity;
  }

  return leftIsUnstableIdentity || rightIsUnstableIdentity;
};

const hasStableTournamentId = (tournament) => Boolean(getTournamentStableId(tournament));
const isCompletedTournament = (tournament) => (
  Boolean(tournament?.champion) || String(tournament?.status || '').trim().toLowerCase() === 'completed'
);

const normalizeTournamentStatus = (tournament) => {
  const normalized = String(tournament?.status || '').trim().toLowerCase();
  if (normalized) return normalized;
  if (tournament?.champion) return 'completed';
  return 'active';
};

const areStatusesCompatibleForDedupe = (left, right) => {
  const leftStatus = normalizeTournamentStatus(left);
  const rightStatus = normalizeTournamentStatus(right);
  if (leftStatus === rightStatus) return true;
  return (
    (leftStatus === 'active' && rightStatus === 'completed')
    || (leftStatus === 'completed' && rightStatus === 'active')
  );
};

const isLikelySameHistoryTournament = (left, right) => {
  if (!left || !right) return false;

  const leftIds = getTournamentIdCandidates(left);
  const rightIds = getTournamentIdCandidates(right);
  if (leftIds.some((id) => rightIds.includes(id))) return true;

  const leftName = normalizeTournamentName(left?.name);
  const rightName = normalizeTournamentName(right?.name);
  if (!leftName || leftName !== rightName) return false;

  if (!areStatusesCompatibleForDedupe(left, right)) return false;

  const leftFormat = normalizeTournamentFormat(left?.tournamentFormat || left?.format || 'league');
  const rightFormat = normalizeTournamentFormat(right?.tournamentFormat || right?.format || 'league');
  if (leftFormat !== rightFormat) return false;

  const leftStableId = getTournamentStableId(left);
  const rightStableId = getTournamentStableId(right);
  const leftHasStableId = Boolean(leftStableId);
  const rightHasStableId = Boolean(rightStableId);
  if (leftHasStableId && rightHasStableId && leftStableId !== rightStableId) {
    return false;
  }

  const leftTeams = getTournamentTeamsCount(left);
  const rightTeams = getTournamentTeamsCount(right);
  if (leftTeams > 0 && rightTeams > 0 && leftTeams !== rightTeams) return false;

  const leftTeamSignature = getTournamentTeamSignature(left);
  const rightTeamSignature = getTournamentTeamSignature(right);
  if (leftTeamSignature && rightTeamSignature && leftTeamSignature !== rightTeamSignature) return false;
  if (leftTeamSignature && rightTeamSignature) return true;

  if (isSameCalendarDay(left, right)) return true;

  const leftMatches = getTournamentMatchPayloadCount(left);
  const rightMatches = getTournamentMatchPayloadCount(right);
  if (leftMatches === 0 || rightMatches === 0) {
    return !leftHasStableId || !rightHasStableId;
  }

  return !leftHasStableId || !rightHasStableId;
};

const pickArrayPayload = (preferred, fallback) => {
  if (Array.isArray(preferred) && preferred.length > 0) return cloneDeep(preferred);
  if (Array.isArray(fallback) && fallback.length > 0) return cloneDeep(fallback);
  return [];
};

const mergeTournamentRecords = (left, right) => {
  const leftCompleted = isCompletedTournament(left);
  const rightCompleted = isCompletedTournament(right);
  let preferred = pickPreferredTournament(left, right);
  if (leftCompleted !== rightCompleted) {
    preferred = leftCompleted ? left : right;
  }
  const fallback = preferred === left ? right : left;
  const completed = leftCompleted || rightCompleted;

  return cloneTournamentRecord({
    ...fallback,
    ...preferred,
    id: preferred?.id || preferred?.appwriteId || fallback?.id || fallback?.appwriteId || null,
    appwriteId: preferred?.appwriteId || fallback?.appwriteId || null,
    name: preferred?.name || fallback?.name || '',
    date: preferred?.date || fallback?.date || '',
    teams: pickArrayPayload(preferred?.teams, fallback?.teams),
    fixtures: pickArrayPayload(preferred?.fixtures, fallback?.fixtures),
    bracket: pickArrayPayload(preferred?.bracket, fallback?.bracket),
    finalMatch: cloneDeep(preferred?.finalMatch || fallback?.finalMatch || null),
    champion: cloneDeep(preferred?.champion || fallback?.champion || null),
    aiSummaries: pickArrayPayload(preferred?.aiSummaries, fallback?.aiSummaries),
    swapHistory: pickArrayPayload(preferred?.swapHistory, fallback?.swapHistory),
    format: preferred?.format || fallback?.format || '1',
    gameMode: preferred?.gameMode || fallback?.gameMode || 'doubles',
    tournamentFormat: normalizeTournamentFormat(
      preferred?.tournamentFormat || preferred?.format || fallback?.tournamentFormat || fallback?.format || 'league'
    ),
    status: completed ? 'completed' : normalizeTournamentStatus(preferred),
    teamsCount: getTournamentTeamsCount(preferred) || getTournamentTeamsCount(fallback) || 0,
    pendingSync: Boolean(preferred?.pendingSync || fallback?.pendingSync),
    createdAt: preferred?.createdAt || fallback?.createdAt || null,
    updatedAt: preferred?.updatedAt || fallback?.updatedAt || null,
  });
};

export const dedupeTournamentHistory = (entries = []) => {
  const source = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const merged = [];

  source.forEach((item) => {
    const normalizedItem = cloneTournamentRecord({
      ...item,
      status: normalizeTournamentStatus(item),
      tournamentFormat: normalizeTournamentFormat(item?.tournamentFormat || item?.format || 'league'),
    });
    const existingIndex = merged.findIndex((existing) => (
      isLikelySameHistoryTournament(existing, normalizedItem)
    ));
    if (existingIndex < 0) {
      merged.push(normalizedItem);
      return;
    }
    merged[existingIndex] = mergeTournamentRecords(merged[existingIndex], normalizedItem);
  });

  return merged;
};

const isLikelyCompletedVersionOfActive = (activeTournament, completedTournament) => {
  if (!activeTournament || !completedTournament) return false;
  if (!isCompletedTournament(completedTournament)) return false;

  const activeIds = getTournamentIdCandidates(activeTournament);
  const completedIds = getTournamentIdCandidates(completedTournament);
  if (activeIds.some((id) => completedIds.includes(id))) return true;

  const activeStableId = getTournamentStableId(activeTournament);
  const completedStableId = getTournamentStableId(completedTournament);
  if (activeStableId && completedStableId && activeStableId !== completedStableId) {
    return false;
  }

  const activeName = normalizeTournamentName(activeTournament?.name);
  const completedName = normalizeTournamentName(completedTournament?.name);
  if (!activeName || activeName !== completedName) return false;

  const activeFormat = normalizeTournamentFormat(
    activeTournament?.tournamentFormat || activeTournament?.format || 'league'
  );
  const completedFormat = normalizeTournamentFormat(
    completedTournament?.tournamentFormat || completedTournament?.format || 'league'
  );
  if (activeFormat !== completedFormat) return false;

  const activeTeams = getTournamentTeamsCount(activeTournament);
  const completedTeams = getTournamentTeamsCount(completedTournament);
  if (activeTeams > 0 && completedTeams > 0 && activeTeams !== completedTeams) return false;

  const activeTeamSignature = getTournamentTeamSignature(activeTournament);
  const completedTeamSignature = getTournamentTeamSignature(completedTournament);
  if (activeTeamSignature && completedTeamSignature && activeTeamSignature !== completedTeamSignature) {
    return false;
  }
  if (activeTeamSignature && completedTeamSignature) return true;

  const sameDay = isSameCalendarDay(activeTournament, completedTournament);
  if (sameDay && (!hasStableTournamentId(activeTournament) || !hasStableTournamentId(completedTournament))) {
    return true;
  }

  return !hasStableTournamentId(activeTournament) && sameDay;
};

export const dedupeLiveTournaments = (candidates = []) => {
  const source = dedupeTournamentHistory(candidates);
  const completedEntries = source.filter((item) => isCompletedTournament(item));
  const list = source
    .filter((item) => item?.status === 'active' && !item?.champion)
    .filter((item) => !completedEntries.some((completed) => (
      isLikelyCompletedVersionOfActive(item, completed)
    )));

  const merged = [];
  list.forEach((item) => {
    const existingIndex = merged.findIndex((entry) => isLikelySameLiveTournament(entry, item));
    if (existingIndex < 0) {
      merged.push(item);
      return;
    }
    merged[existingIndex] = pickPreferredTournament(merged[existingIndex], item);
  });

  return merged;
};

export const buildTournamentFromLock = (lock) => {
  if (!lock || lock.status !== 'active') return null;
  const resolvedId = lock.appwriteId || lock.id || null;
  return {
    id: resolvedId,
    appwriteId: resolvedId,
    legacyTournamentId: lock.legacyTournamentId || null,
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
