// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getTournamentProgressScore, pickPreferredTournament } from '../utils/appHelpers';

describe('pickPreferredTournament', () => {
  it('prefers richer payload over summary when no matches are completed yet', () => {
    const summary = {
      id: 'tour-1',
      name: 'Club Night',
      status: 'active',
      isSummary: true,
      teams: [],
      fixtures: [],
      bracket: [],
    };
    const detailedFromLock = {
      id: 'tour-1',
      name: 'Club Night',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [
        { id: 'm1', completed: false },
        { id: 'm2', completed: false },
      ],
      bracket: [],
    };

    expect(getTournamentProgressScore(detailedFromLock)).toBeGreaterThan(getTournamentProgressScore(summary));
    expect(pickPreferredTournament(summary, detailedFromLock)).toEqual(detailedFromLock);
  });

  it('still prefers more completed progress when both payloads are detailed', () => {
    const earlier = {
      id: 'tour-2',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [
        { id: 'm1', completed: true },
        { id: 'm2', completed: false },
      ],
      bracket: [],
    };
    const later = {
      ...earlier,
      fixtures: [
        { id: 'm1', completed: true },
        { id: 'm2', completed: true },
      ],
    };

    expect(pickPreferredTournament(earlier, later)).toEqual(later);
  });
});
