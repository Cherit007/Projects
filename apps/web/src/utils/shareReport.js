import { shareTournamentInvite } from './shareTournament.js';

/** @param {import('@fixture-maker/domain/sports/reportTypes.js').SportReportResult|null|undefined} report */
export const buildReportSummaryText = (report, { tournamentName = '', sportLabel = '' } = {}) => {
  if (!report) return '';
  const context = [
    tournamentName ? `📛 ${tournamentName}` : null,
    sportLabel ? `🏅 ${sportLabel}` : null,
    `📊 ${report.title}${report.summary ? ` — ${report.summary}` : ''}`,
  ].filter(Boolean);
  const lines = (report.rows || []).map((row) => {
    const prefix = row.rank ? `${row.rank}. ` : '• ';
    const detail = row.detail ? ` (${row.detail})` : '';
    return `${prefix}${row.label}: ${row.value}${detail}`;
  });
  return [...context, ...lines].join('\n');
};

export const buildReportShareMessage = ({
  tournamentName = '',
  sportLabel = '',
  report,
} = {}) => {
  const message = buildReportSummaryText(report, { tournamentName, sportLabel });
  if (!message.trim()) return null;
  return {
    title: tournamentName ? `${tournamentName} — ${report?.title || 'Report'}` : report?.title || 'Tournament report',
    message,
  };
};

export const shareReportSnapshot = async (options = {}) => {
  const payload = buildReportShareMessage(options);
  if (!payload) {
    return { method: 'error', reason: 'empty-report' };
  }
  return shareTournamentInvite({
    message: payload.message,
    title: payload.title,
  });
};

export const shareReportOnWhatsApp = (options = {}) => {
  const payload = buildReportShareMessage(options);
  if (!payload?.message) {
    return { method: 'error', reason: 'empty-report' };
  }
  return shareTournamentInvite({
    message: payload.message,
    title: payload.title,
  });
};

const escapeHtml = (value) => (
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

export const buildReportPrintHtml = ({
  tournamentName = '',
  sportLabel = '',
  report,
} = {}) => {
  if (!report) return '';
  const rows = (report.rows || []).map((row) => (
    `<tr>
      <td>${escapeHtml(row.rank ? `#${row.rank}` : '—')}</td>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.value)}</td>
      <td>${escapeHtml(row.detail || '')}</td>
    </tr>`
  )).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(tournamentName || report.title || 'Report')}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    p.meta { color: #555; margin: 0 0 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.5rem 0.35rem; text-align: left; }
    th { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.title || 'Report')}</h1>
  <p class="meta">${escapeHtml([tournamentName, sportLabel, report.summary].filter(Boolean).join(' · '))}</p>
  <table>
    <thead><tr><th>Rank</th><th>Name</th><th>Value</th><th>Detail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
};

export const printReportSnapshot = (options = {}) => {
  if (typeof window === 'undefined' || !options?.report) {
    return { method: 'error', reason: 'unsupported-platform' };
  }
  const html = buildReportPrintHtml(options);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    return { method: 'error', reason: 'popup-blocked' };
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return { method: 'print' };
};
