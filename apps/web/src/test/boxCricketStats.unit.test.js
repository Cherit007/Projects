import { describe, it, expect } from 'vitest';
import { buildBoxCricketStatsRows, sortBoxCricketRunLeaders, sortBoxCricketWicketLeaders } from '../utils/boxCricketStats';

describe('boxCricketStats', () => {
  const sample = [
    { name: 'Alex', cricketRuns: 40, cricketWickets: 2 },
    { name: 'Ben', cricketRuns: 10, cricketWickets: 5 },
    { name: 'Chris', cricketRuns: 25, cricketWickets: 1 },
  ];

  it('sorts run leaders by runs', () => {
    expect(sortBoxCricketRunLeaders(sample).map((row) => row.name)).toEqual(['Alex', 'Chris', 'Ben']);
  });

  it('sorts wicket leaders by wickets', () => {
    expect(sortBoxCricketWicketLeaders(sample).map((row) => row.name)).toEqual(['Ben', 'Alex', 'Chris']);
  });

  it('builds tab-specific rows', () => {
    expect(buildBoxCricketStatsRows(sample, 'wickets')[0].name).toBe('Ben');
    expect(buildBoxCricketStatsRows(sample, 'runs')[0].name).toBe('Alex');
  });
});
