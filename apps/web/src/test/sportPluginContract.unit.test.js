import { describe, expect, it } from 'vitest';
import {
  getSportPlugin,
  listSportPluginManifest,
  listSportPlugins,
  listSports,
} from '@fixture-maker/domain/sports';

describe('sport plugin contract', () => {
  it('lists registered plugins and manifest entries', () => {
    const plugins = listSportPlugins();
    const manifest = listSportPluginManifest();
    expect(plugins.length).toBeGreaterThanOrEqual(3);
    expect(manifest.length).toBe(listSports().length);
    manifest.forEach((entry) => {
      expect(entry.sportId).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(Array.isArray(entry.reportTypes)).toBe(true);
    });
  });

  listSportPlugins().forEach((plugin) => {
    it(`${plugin.id} exposes required plugin strategies`, () => {
      expect(plugin.config?.id).toBe(plugin.id);
      expect(typeof plugin.fixture.generateFixturesByFormat).toBe('function');
      expect(typeof plugin.scoring.calculatePointsTable).toBe('function');
      expect(typeof plugin.stats.calculatePlayerStats).toBe('function');
      expect(typeof plugin.rankings.calculateStandings).toBe('function');
      expect(typeof plugin.reports.listReportTypes).toBe('function');
      expect(typeof plugin.reports.generateReport).toBe('function');
    });

    it(`${plugin.id} generates fixtures for three teams`, () => {
      const teams = [
        { id: 1, name: 'A', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'B', player1: 'B1', player2: 'B2' },
        { id: 3, name: 'C', player1: 'C1', player2: 'C2' },
      ];
      const result = plugin.fixture.generateFixturesByFormat(teams, {
        tournamentFormat: 'league',
        format: '1',
      });
      expect(result.kind).toBe('league');
      expect(result.fixtures?.length).toBeGreaterThan(0);
    });
  });

  it('badminton standings match points table path', () => {
    const plugin = getSportPlugin('badminton');
    const teams = [
      { id: 1, name: 'A', player1: 'A1', player2: 'A2' },
      { id: 2, name: 'B', player1: 'B1', player2: 'B2' },
    ];
    const fixtures = [{
      id: 'm1',
      completed: true,
      score1: 21,
      score2: 15,
      team1: teams[0],
      team2: teams[1],
    }];
    const standings = plugin.rankings.calculateStandings(teams, fixtures, {});
    const table = plugin.scoring.calculatePointsTable(teams, fixtures, {});
    expect(standings).toEqual(table);
  });
});
