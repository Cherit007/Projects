import { describe, expect, it } from 'vitest';
import {
  buildReportPrintHtml,
  buildReportShareMessage,
  buildReportSummaryText,
} from '../utils/shareReport.js';

const sampleReport = {
  type: 'topPlayers',
  title: 'Top players',
  summary: 'Ranked by match wins',
  rows: [
    { rank: 1, label: 'Amy', value: '2 wins', detail: 'Aces' },
    { rank: 2, label: 'Dan', value: '1 wins', detail: 'Dinks' },
  ],
};

describe('shareReport', () => {
  it('builds summary and share message text', () => {
    const summary = buildReportSummaryText(sampleReport, {
      tournamentName: 'Friday League',
      sportLabel: 'Pickleball',
    });
    expect(summary).toContain('Friday League');
    expect(summary).toContain('Top players');
    expect(summary).toContain('1. Amy: 2 wins');

    const payload = buildReportShareMessage({
      tournamentName: 'Friday League',
      sportLabel: 'Pickleball',
      report: sampleReport,
    });
    expect(payload?.title).toContain('Friday League');
    expect(payload?.message).toContain('Amy');
  });

  it('returns null share payload for empty report', () => {
    expect(buildReportShareMessage({ report: null })).toBeNull();
  });

  it('builds printable HTML with escaped content', () => {
    const html = buildReportPrintHtml({
      tournamentName: 'Cup <final>',
      sportLabel: 'Pickleball',
      report: sampleReport,
    });
    expect(html).toContain('Top players');
    expect(html).toContain('Cup &lt;final&gt;');
    expect(html).toContain('<table>');
  });
});
