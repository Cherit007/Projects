import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { getSport, getSportPlugin } from '@fixture-maker/domain/sports';
import { PICKLEBALL_REPORT_CATALOG } from '@fixture-maker/domain/sports/pickleball/PickleballReportEngine.js';
import { BOX_CRICKET_REPORT_CATALOG } from '@fixture-maker/domain/sports/boxCricket/BoxCricketReportEngine.js';
import { BADMINTON_REPORT_CATALOG } from '@fixture-maker/domain/sports/badminton/BadmintonReportEngine.js';
import {
  buildReportSummaryText,
  printReportSnapshot,
  shareReportOnWhatsApp,
  shareReportSnapshot,
} from '../../utils/shareReport';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};
const MotionSection = motion.section;

const REPORT_CATALOG_BY_SPORT = {
  badminton: BADMINTON_REPORT_CATALOG,
  pickleball: PICKLEBALL_REPORT_CATALOG,
  boxCricket: BOX_CRICKET_REPORT_CATALOG,
};

const ReportsTab = ({
  isActive,
  sportId,
  tournamentFormat,
  teams,
  fixtures,
  ruleConfig,
  tournamentName,
}) => {
  const sport = useMemo(() => getSport(sportId), [sportId]);
  const plugin = useMemo(() => getSportPlugin(sportId), [sportId]);
  const reportCatalog = REPORT_CATALOG_BY_SPORT[sportId] || [];
  const reportTypeIds = useMemo(() => plugin.reports.listReportTypes(), [plugin]);
  const [selectedReportType, setSelectedReportType] = useState(reportTypeIds[0] || '');
  const [shareFeedback, setShareFeedback] = useState('');

  const activeReportType = reportTypeIds.includes(selectedReportType)
    ? selectedReportType
    : reportTypeIds[0];

  const report = useMemo(() => {
    if (!activeReportType) return null;
    return plugin.reports.generateReport({
      reportType: activeReportType,
      teams,
      fixtures,
      ruleConfig,
      tournamentName,
    });
  }, [plugin, activeReportType, teams, fixtures, ruleConfig, tournamentName]);

  if (!isActive || tournamentFormat !== 'league' || reportTypeIds.length === 0) return null;

  const shareOptions = {
    tournamentName,
    sportLabel: sport.name,
    report,
  };

  const flashShareFeedback = (label) => {
    setShareFeedback(label);
    window.setTimeout(() => setShareFeedback(''), 1800);
  };

  const handleCopySummary = async () => {
    const text = buildReportSummaryText(report, {
      tournamentName,
      sportLabel: sport.name,
    });
    if (!text || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      flashShareFeedback('Copied');
    } catch {
      // Clipboard unavailable in some test/runtime contexts.
    }
  };

  const handleShare = async () => {
    const result = await shareReportSnapshot(shareOptions);
    if (result.method === 'native-share') flashShareFeedback('Shared');
    if (result.method === 'whatsapp') flashShareFeedback('Opened WhatsApp');
  };

  const handleWhatsApp = () => {
    shareReportOnWhatsApp(shareOptions);
    flashShareFeedback('Opened WhatsApp');
  };

  const handlePrint = () => {
    const result = printReportSnapshot(shareOptions);
    if (result.method === 'print') flashShareFeedback('Print ready');
  };

  return (
    <MotionSection
      key="tab-reports"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="variant-a-card"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="variant-a-section-label">Reports</p>
          <p className="variant-a-meta-copy">Sport-aware tournament snapshots</p>
        </div>
        {report?.rows?.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="variant-a-header-action text-sm"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="variant-a-header-action text-sm inline-flex items-center gap-1"
              aria-label="Share report"
            >
              <Share2 size={14} aria-hidden="true" />
              Share
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="variant-a-header-action text-sm"
              aria-label="Share on WhatsApp"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="variant-a-header-action text-sm"
              aria-label="Print report"
            >
              Print / PDF
            </button>
            {shareFeedback && (
              <span className="text-xs font-semibold text-emerald-600">{shareFeedback}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {reportCatalog
          .filter((entry) => reportTypeIds.includes(entry.id))
          .map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedReportType(entry.id)}
              className={`variant-a-desktop-tab tour-tab-btn ${
                activeReportType === entry.id ? 'tour-tab-active' : ''
              }`}
            >
              {entry.label}
            </button>
          ))}
      </div>

      {!report || report.rows.length === 0 ? (
        <div className="variant-a-empty-card">
          <p>{report?.summary || 'Complete matches to unlock this report.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {report.summary && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{report.summary}</p>
          )}
          {report.rows.map((row) => (
            <article key={`${row.rank || 'x'}-${row.label}`} className="variant-a-stat-card">
              <div className="variant-a-stat-head">
                <div className="min-w-0">
                  <p className="variant-a-stat-name">
                    {row.rank ? `#${row.rank} ` : ''}
                    {row.label}
                  </p>
                  {row.detail && <p className="variant-a-stat-team">{row.detail}</p>}
                </div>
                <div className="variant-a-stat-elo">{row.value}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </MotionSection>
  );
};

export default ReportsTab;
