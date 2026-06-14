import { describe, it, expect, beforeEach } from 'vitest';
import { webStorage } from '../platform/storage';
import { STORAGE_KEYS } from '../platform/storageKeys';
import {
  enrichCasualMatches,
  hasViewableBoxCricketDetail,
  persistCasualMatchStatisticsBackup,
} from '../utils/casualMatchHydration';

describe('casualMatchHydration', () => {
  beforeEach(() => {
    webStorage.removeItem(STORAGE_KEYS.CASUAL_MATCHES);
    webStorage.removeItem(STORAGE_KEYS.CASUAL_MATCH_STATISTICS);
  });

  it('restores statistics from local backup when cloud match is missing them', () => {
    const statistics = {
      sportId: 'boxCricket',
      format: 'casualSeries',
      series: { games: [{ gameNo: 1, statistics: { scoringMode: 'ballByBall', innings: [] } }] },
    };

    webStorage.setJson(STORAGE_KEYS.CASUAL_MATCHES, [{
      id: 'cloud-id-1',
      appwriteId: 'cloud-id-1',
      sportId: 'boxCricket',
      statistics,
      team1: { id: 1, name: 'Aces', squad: [{ id: 'p1', name: 'Alex' }] },
      team2: { id: 2, name: 'Blaze', squad: [{ id: 'p2', name: 'Ben' }] },
      score1: 45,
      score2: 40,
      completed: true,
    }]);

    const cloudMatch = {
      id: 'cloud-id-1',
      appwriteId: 'cloud-id-1',
      sportId: 'boxCricket',
      team1: { id: 1, name: 'Aces' },
      team2: { id: 2, name: 'Blaze' },
      score1: 45,
      score2: 40,
      completed: true,
    };

    const enriched = enrichCasualMatches([cloudMatch]);
    expect(enriched[0].statistics).toEqual(statistics);
    expect(hasViewableBoxCricketDetail(enriched[0])).toBe(true);
  });

  it('restores statistics from dedicated backup map by match id', () => {
    const statistics = {
      sportId: 'boxCricket',
      series: { games: [] },
    };

    persistCasualMatchStatisticsBackup({
      id: 'cloud-id-2',
      statistics,
    });

    const enriched = enrichCasualMatches([{
      id: 'cloud-id-2',
      matchType: 'team',
      score1: 30,
      score2: 28,
      completed: true,
    }]);

    expect(enriched[0].statistics).toEqual(statistics);
  });
});
