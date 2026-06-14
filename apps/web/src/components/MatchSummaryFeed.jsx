import React from 'react';
import { Sparkles } from 'lucide-react';

const formatSummaryTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const MatchSummaryFeed = ({ summaries = [] }) => {
  if (!Array.isArray(summaries) || summaries.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-4 sm:p-5 match-summary-shell">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 match-summary-heading">
          <Sparkles size={18} className="text-blue-600" />
          AI Match Summary
        </h3>
        <span className="text-xs text-gray-500 match-summary-count">{summaries.length} saved</span>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {summaries.map((summary) => (
          <div key={summary.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 match-summary-card">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 match-summary-title">{summary.title}</p>
              <span className="text-[11px] text-gray-500 whitespace-nowrap match-summary-time">
                {formatSummaryTime(summary.createdAt)}
              </span>
            </div>
            <p className="text-xs text-gray-700 whitespace-pre-line mt-2 match-summary-body">{summary.narrative}</p>
            {summary.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {summary.tags.map((tag) => (
                  <span
                    key={`${summary.id}-${tag}`}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-700 font-medium match-summary-tag"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchSummaryFeed;
