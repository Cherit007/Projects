// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  findScheduleConflicts,
  formatMatchScheduleLabel,
  normalizeMatchSchedule,
  parseMatchScheduleJson,
  serializeMatchSchedule,
} from '@fixture-maker/domain/fixture/matchSchedule';

describe('matchSchedule', () => {
  it('normalizes and serializes schedule payloads', () => {
    const schedule = normalizeMatchSchedule({
      groundLabel: 'Court A',
      startAt: '2026-06-13T10:00:00.000Z',
      endAt: '2026-06-13T11:00:00.000Z',
    });
    const json = serializeMatchSchedule(schedule);
    expect(parseMatchScheduleJson(json)?.groundLabel).toBe('Court A');
    expect(formatMatchScheduleLabel(schedule)).toContain('Court A');
  });

  it('detects overlapping ground slots', () => {
    const fixtures = [
      {
        id: 1,
        team1: { name: 'A' },
        team2: { name: 'B' },
        schedule: {
          groundLabel: 'Court A',
          startAt: '2026-06-13T10:00:00.000Z',
          endAt: '2026-06-13T11:00:00.000Z',
        },
      },
      {
        id: 2,
        team1: { name: 'C' },
        team2: { name: 'D' },
        schedule: {
          groundLabel: 'Court A',
          startAt: '2026-06-13T10:30:00.000Z',
          endAt: '2026-06-13T11:30:00.000Z',
        },
      },
    ];
    const result = findScheduleConflicts(fixtures[1], fixtures, { ignoreMatchId: 2 });
    expect(result.hasOverlap).toBe(true);
    expect(result.conflicts[0].matchId).toBe(1);
  });
});
