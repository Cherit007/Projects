import { describe, expect, it } from 'vitest';
import { generatePickleballReport, listPickleballReportTypes } from '@fixture-maker/domain/sports/pickleball/PickleballReportEngine.js';
import { generateBoxCricketReport, listBoxCricketReportTypes } from '@fixture-maker/domain/sports/boxCricket/BoxCricketReportEngine.js';
import { generateBadmintonReport, listBadmintonReportTypes } from '@fixture-maker/domain/sports/badminton/BadmintonReportEngine.js';
import { getSportPlugin } from '@fixture-maker/domain/sports';

const pickleballTeams = [
  { id: 1, name: 'Aces', player1: 'Amy', player2: 'Alex' },
  { id: 2, name: 'Dinks', player1: 'Dan', player2: 'Dana' },
];

const pickleballFixtures = [
  {
    id: 'm1',
    completed: true,
    score1: 11,
    score2: 8,
    team1: { name: 'Aces', player1: 'Amy', player2: 'Alex' },
    team2: { name: 'Dinks', player1: 'Dan', player2: 'Dana' },
    statistics: {
      sportId: 'pickleball',
      team1: { aces: 3, serviceWins: 5, serviceFaults: 1 },
      team2: { aces: 1, serviceWins: 2, serviceFaults: 4 },
    },
  },
];

const boxCricketTeams = [
  { id: 1, name: 'Blazers', squad: [{ name: 'R1', role: 'captain' }] },
  { id: 2, name: 'Strikers', squad: [{ name: 'S1', role: 'captain' }] },
];

const boxCricketFixtures = [
  {
    id: 'bc1',
    completed: true,
    score1: 54,
    score2: 48,
    team1: { name: 'Blazers' },
    team2: { name: 'Strikers' },
    statistics: { sportId: 'boxCricket' },
  },
];

describe('sport report engines', () => {
  it('lists report types per sport plugin', () => {
    expect(listPickleballReportTypes()).toContain('topPlayers');
    expect(listBoxCricketReportTypes()).toContain('bestNRR');
    expect(listBadmintonReportTypes()).toContain('mostPoints');
    expect(getSportPlugin('pickleball').reports.listReportTypes().length).toBeGreaterThan(0);
  });

  it('generates pickleball top players and longest match reports', () => {
    const topPlayers = generatePickleballReport({
      reportType: 'topPlayers',
      teams: pickleballTeams,
      fixtures: pickleballFixtures,
    });
    expect(topPlayers?.rows?.[0]?.label).toBeTruthy();
    expect(topPlayers?.rows?.[0]?.value).toMatch(/wins/);

    const longest = generatePickleballReport({
      reportType: 'longestMatch',
      teams: pickleballTeams,
      fixtures: pickleballFixtures,
    });
    expect(longest?.rows?.[0]?.value).toBe('19');
  });

  it('generates box cricket NRR and highest score reports', () => {
    const nrr = generateBoxCricketReport({
      reportType: 'bestNRR',
      teams: boxCricketTeams,
      fixtures: boxCricketFixtures,
      ruleConfig: { oversLimit: 6 },
    });
    expect(nrr?.rows?.length).toBeGreaterThan(0);

    const highest = generateBoxCricketReport({
      reportType: 'highestTeamScore',
      teams: boxCricketTeams,
      fixtures: boxCricketFixtures,
    });
    expect(highest?.rows?.[0]?.value).toBe('54 runs');
  });

  it('generates badminton reports from completed fixtures', () => {
    const report = generateBadmintonReport({
      reportType: 'topPlayers',
      teams: pickleballTeams,
      fixtures: pickleballFixtures,
    });
    expect(report?.rows?.length).toBeGreaterThan(0);
  });
});
