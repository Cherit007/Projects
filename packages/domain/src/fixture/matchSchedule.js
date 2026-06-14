/** @typedef {{ groundId?: string, groundLabel?: string, startAt?: string, endAt?: string }} MatchScheduleSlot */

export const normalizeMatchSchedule = (input) => {
  const source = input && typeof input === 'object' ? input : {};
  const groundId = String(source.groundId || '').trim();
  const groundLabel = String(source.groundLabel || source.ground || '').trim();
  const startAt = String(source.startAt || source.scheduledStartAt || '').trim();
  const endAt = String(source.endAt || source.scheduledEndAt || '').trim();
  if (!groundId && !groundLabel && !startAt && !endAt) return null;
  return {
    ...(groundId ? { groundId } : {}),
    ...(groundLabel ? { groundLabel } : {}),
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
  };
};

export const serializeMatchSchedule = (schedule) => {
  const normalized = normalizeMatchSchedule(schedule);
  if (!normalized) return '';
  return JSON.stringify(normalized);
};

export const parseMatchScheduleJson = (scheduleJson) => {
  if (!scheduleJson) return null;
  if (typeof scheduleJson === 'object') return normalizeMatchSchedule(scheduleJson);
  if (typeof scheduleJson !== 'string') return null;
  try {
    return normalizeMatchSchedule(JSON.parse(scheduleJson));
  } catch {
    return null;
  }
};

const parseTimestamp = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
};

/** @returns {{ hasOverlap: boolean, conflicts: Array<{ matchId: string|number, label: string }> }} */
export const findScheduleConflicts = (match, fixtures = [], { ignoreMatchId = null } = {}) => {
  const schedule = normalizeMatchSchedule(match?.schedule);
  if (!schedule?.startAt) {
    return { hasOverlap: false, conflicts: [] };
  }
  const start = parseTimestamp(schedule.startAt);
  const end = parseTimestamp(schedule.endAt) || start;
  if (!Number.isFinite(start)) {
    return { hasOverlap: false, conflicts: [] };
  }

  const conflicts = (Array.isArray(fixtures) ? fixtures : [])
    .filter((entry) => entry && entry.id !== ignoreMatchId)
    .map((entry) => {
      const other = normalizeMatchSchedule(entry.schedule);
      if (!other?.startAt) return null;
      const otherStart = parseTimestamp(other.startAt);
      const otherEnd = parseTimestamp(other.endAt) || otherStart;
      if (!Number.isFinite(otherStart)) return null;
      const sameGround = schedule.groundId && other.groundId
        ? schedule.groundId === other.groundId
        : schedule.groundLabel && other.groundLabel
          ? schedule.groundLabel.toLowerCase() === other.groundLabel.toLowerCase()
          : false;
      if (!sameGround) return null;
      const overlaps = start <= otherEnd && end >= otherStart;
      if (!overlaps) return null;
      return {
        matchId: entry.id,
        label: `${entry.team1?.name || 'Team 1'} vs ${entry.team2?.name || 'Team 2'}`,
      };
    })
    .filter(Boolean);

  return {
    hasOverlap: conflicts.length > 0,
    conflicts,
  };
};

export const formatMatchScheduleLabel = (schedule) => {
  const normalized = normalizeMatchSchedule(schedule);
  if (!normalized) return '';
  const parts = [];
  if (normalized.groundLabel) parts.push(normalized.groundLabel);
  if (normalized.startAt) {
    const date = new Date(normalized.startAt);
    parts.push(Number.isFinite(date.getTime())
      ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : normalized.startAt);
  }
  return parts.join(' · ');
};
