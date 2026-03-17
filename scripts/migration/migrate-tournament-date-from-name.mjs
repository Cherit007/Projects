import fs from 'node:fs/promises';
import path from 'node:path';
import { Query } from 'appwrite';

import {
  createDatabasesClient,
  ensureDir,
  fetchCollectionAttributes,
  listAllDocuments,
  normalizedCollections,
  nowIso,
  parseArgs,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args['--apply']);
const batchSize = Math.max(1, Number(args['--batch-size'] || 100));
const onlyGroupId = String(args['--group-id'] || '').trim();
const overwrite = Boolean(args['--overwrite']);
const clearWhenMissing = Boolean(args['--clear-when-missing']);
const statusFilter = String(args['--status'] || (args['--completed-only'] ? 'completed' : '')).trim().toLowerCase();
const forceDayFirst = Boolean(args['--day-first']);
const forceMonthFirst = Boolean(args['--month-first']);
const reportDir = path.resolve(String(args['--report-dir'] || 'migration-reports'));

if (args['--help']) {
  console.log(
    'Usage: node scripts/migration/migrate-tournament-date-from-name.mjs [options]\n\n' +
    'Options:\n' +
    '  --apply                  Apply writes (default is dry-run)\n' +
    '  --batch-size <n>         Update batch size (default: 100)\n' +
    '  --group-id <id>          Only migrate tournaments in one group\n' +
    '  --overwrite              Replace dateLabel even if already set\n' +
    '  --clear-when-missing     Clear dateLabel when name has no parseable date (use with --overwrite)\n' +
    '  --status <value>         Only update tournaments with this status (e.g., completed)\n' +
    '  --completed-only         Shortcut for --status completed\n' +
    '  --day-first              Treat ambiguous dates as DD/MM (overrides locale)\n' +
    '  --month-first            Treat ambiguous dates as MM/DD (overrides locale)\n' +
    '  --report-dir <path>      Summary output directory (default: migration-reports)\n' +
    '  --help                   Show this help\n'
  );
  process.exit(0);
}

const toText = (value) => String(value || '').trim();

const prefersDayFirst = (() => {
  if (forceDayFirst) return true;
  if (forceMonthFirst) return false;
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

const monthMap = new Map([
  ['jan', 1], ['january', 1],
  ['feb', 2], ['february', 2],
  ['mar', 3], ['march', 3],
  ['apr', 4], ['april', 4],
  ['may', 5],
  ['jun', 6], ['june', 6],
  ['jul', 7], ['july', 7],
  ['aug', 8], ['august', 8],
  ['sep', 9], ['sept', 9], ['september', 9],
  ['oct', 10], ['october', 10],
  ['nov', 11], ['november', 11],
  ['dec', 12], ['december', 12],
]);

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildIsoDate = ({ year, month, day }) => {
  const y = toInt(year);
  const m = toInt(month);
  const d = toInt(day);
  if (!y || !m || !d) return '';
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
};

const resolveDocYear = (doc) => {
  const raw = toText(doc?.sourceCreatedAt || doc?.$createdAt);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).getUTCFullYear();
};

const parseNumericDate = ({ first, second, year }) => {
  const a = toInt(first);
  const b = toInt(second);
  const y = toInt(year);
  if (!a || !b || !y) return '';
  let month = a;
  let day = b;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    month = a;
    day = b;
  } else if (prefersDayFirst) {
    day = a;
    month = b;
  }
  return buildIsoDate({ year: y, month, day });
};

const parseMonthName = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return monthMap.get(key) || null;
};

const extractDateFromName = (name, docYear) => {
  const raw = toText(name);
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const yearFirst = lower.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (yearFirst) {
    const iso = buildIsoDate({ year: yearFirst[1], month: yearFirst[2], day: yearFirst[3] });
    if (iso) return { iso, source: yearFirst[0], mode: 'year-first' };
  }

  const numericWithYear = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (numericWithYear) {
    const iso = parseNumericDate({ first: numericWithYear[1], second: numericWithYear[2], year: numericWithYear[3] });
    if (iso) return { iso, source: numericWithYear[0], mode: 'numeric-year' };
  }

  const monthNameWithYear = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{4})\b/);
  if (monthNameWithYear) {
    const month = parseMonthName(monthNameWithYear[2]);
    const iso = buildIsoDate({ year: monthNameWithYear[3], month, day: monthNameWithYear[1] });
    if (iso) return { iso, source: monthNameWithYear[0], mode: 'day-month-year' };
  }

  const monthNameWithYearAlt = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})\b/);
  if (monthNameWithYearAlt) {
    const month = parseMonthName(monthNameWithYearAlt[1]);
    const iso = buildIsoDate({ year: monthNameWithYearAlt[3], month, day: monthNameWithYearAlt[2] });
    if (iso) return { iso, source: monthNameWithYearAlt[0], mode: 'month-day-year' };
  }

  const fallbackYear = toInt(docYear);
  if (!fallbackYear) return null;

  const monthNameNoYear = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  if (monthNameNoYear) {
    const month = parseMonthName(monthNameNoYear[2]);
    const iso = buildIsoDate({ year: fallbackYear, month, day: monthNameNoYear[1] });
    if (iso) return { iso, source: monthNameNoYear[0], mode: 'day-month' };
  }

  const monthNameNoYearAlt = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthNameNoYearAlt) {
    const month = parseMonthName(monthNameNoYearAlt[1]);
    const iso = buildIsoDate({ year: fallbackYear, month, day: monthNameNoYearAlt[2] });
    if (iso) return { iso, source: monthNameNoYearAlt[0], mode: 'month-day' };
  }

  const numericNoYear = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})\b/);
  if (numericNoYear) {
    const iso = parseNumericDate({ first: numericNoYear[1], second: numericNoYear[2], year: fallbackYear });
    if (iso) return { iso, source: numericNoYear[0], mode: 'numeric-no-year' };
  }

  return null;
};

const run = async () => {
  const { databases, config } = createDatabasesClient();
  const collections = normalizedCollections();
  const collectionId = collections.tournamentsV2;

  const attrs = await fetchCollectionAttributes({ config, collectionId });
  const attrSet = new Set(attrs.map((attr) => toText(attr?.key)).filter(Boolean));
  const required = ['name', 'dateLabel'];
  const missing = required.filter((key) => !attrSet.has(key));
  if (missing.length > 0) {
    throw new Error(`[preflight] tournamentsV2 missing attributes: ${missing.join(', ')}`);
  }
  const hasSourceUpdatedAt = attrSet.has('sourceUpdatedAt');

  const extraQueries = [];
  if (onlyGroupId) {
    extraQueries.push(Query.equal('groupId', onlyGroupId));
  }

  const allTournaments = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId,
    extraQueries,
  });

  const tournaments = statusFilter
    ? allTournaments.filter((doc) => toText(doc?.status).toLowerCase() === statusFilter)
    : allTournaments;

  const summary = {
    apply,
    scanned: allTournaments.length,
    filtered: tournaments.length,
    matched: 0,
    cleared: 0,
    updated: 0,
    skipped: {
      dateLabelPresent: 0,
      noDateInName: 0,
    },
    groupId: onlyGroupId || null,
    dayFirst: prefersDayFirst,
    overwrite,
    clearWhenMissing,
    statusFilter: statusFilter || null,
    reportFile: '',
    samples: [],
  };

  const updates = [];
  const now = nowIso();

  for (const doc of tournaments) {
    const dateLabel = toText(doc?.dateLabel);
    if (dateLabel && !overwrite) {
      summary.skipped.dateLabelPresent += 1;
      continue;
    }

    const found = extractDateFromName(doc?.name, resolveDocYear(doc));
    if (!found) {
      summary.skipped.noDateInName += 1;
      if (clearWhenMissing && dateLabel) {
        const payload = {
          dateLabel: '',
          ...(hasSourceUpdatedAt ? { sourceUpdatedAt: now } : {}),
        };
        updates.push({
          id: doc.$id,
          name: toText(doc?.name),
          previousDateLabel: dateLabel,
          nextDateLabel: '',
          source: '',
          mode: 'cleared',
          payload,
        });
        summary.cleared += 1;
      }
      continue;
    }

    summary.matched += 1;
    const payload = {
      dateLabel: found.iso,
      ...(hasSourceUpdatedAt ? { sourceUpdatedAt: now } : {}),
    };

    updates.push({
      id: doc.$id,
      name: toText(doc?.name),
      previousDateLabel: dateLabel,
      nextDateLabel: found.iso,
      source: found.source,
      mode: found.mode,
      payload,
    });
  }

  if (!apply) {
    console.log(`[dry-run] tournaments to update: ${updates.length}`);
  } else {
    const batches = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      for (const update of batch) {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(
          config.databaseId,
          collectionId,
          update.id,
          update.payload
        );
        summary.updated += 1;
      }
      console.log(`[apply] updated ${summary.updated}/${updates.length}`);
    }
  }

  summary.samples = updates.slice(0, 25).map((row) => ({
    id: row.id,
    name: row.name,
    previousDateLabel: row.previousDateLabel,
    nextDateLabel: row.nextDateLabel,
    source: row.source,
    mode: row.mode,
  }));

  await ensureDir(reportDir);
  const reportPath = path.join(
    reportDir,
    `tournament-date-from-name-${now.replace(/[:.]/g, '-')}.json`
  );
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  summary.reportFile = reportPath;

  console.log('[date-from-name] summary:', JSON.stringify({
    scanned: summary.scanned,
    matched: summary.matched,
    updated: summary.updated,
    skipped: summary.skipped,
    reportFile: reportPath,
  }));
};

run().catch((error) => {
  console.error('[date-from-name] failed:', error?.message || error);
  process.exitCode = 1;
});
