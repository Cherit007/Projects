import React from 'react';

const StatTable = ({ title, rows, emptyText, nameLabel = 'Name' }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 profile-insight-table">
    <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-gray-500">{emptyText}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-2">{nameLabel}</th>
              <th className="py-1.5 px-2 text-center">P</th>
              <th className="py-1.5 px-2 text-center">W</th>
              <th className="py-1.5 px-2 text-center">L</th>
              <th className="py-1.5 pl-2 text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map(row => (
              <tr key={row.name} className="border-b border-gray-100 last:border-b-0">
                <td className="py-1.5 pr-2 font-semibold text-gray-800 truncate max-w-[170px]">{row.name}</td>
                <td className="py-1.5 px-2 text-center">{row.played}</td>
                <td className="py-1.5 px-2 text-center text-green-700">{row.wins}</td>
                <td className="py-1.5 px-2 text-center text-red-700">{row.losses}</td>
                <td className="py-1.5 pl-2 text-right font-semibold">{row.winRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const AdvancedProfileInsights = ({ advancedStats }) => {
  if (!advancedStats) return null;

  return (
    <div className="space-y-3 mt-4 profile-insights-panel">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 profile-insight-summary">
        <p className="text-xs text-blue-700 font-semibold">
          Tracked matches for advanced insights: {advancedStats.totalTrackedMatches}
        </p>
      </div>

      <StatTable
        title="Head-to-Head"
        rows={advancedStats.headToHead || []}
        emptyText="No head-to-head data yet."
        nameLabel="Opponent"
      />

      <StatTable
        title="Preferred Partner Combos"
        rows={advancedStats.preferredPartners || []}
        emptyText="No doubles partner data yet."
        nameLabel="Partner"
      />

      <StatTable
        title="Win Rate by Format"
        rows={advancedStats.winRateByFormat || []}
        emptyText="No format data available yet."
        nameLabel="Format"
      />

      <StatTable
        title="Performance by Venue"
        rows={advancedStats.performanceByVenue || []}
        emptyText="No venue data available yet."
        nameLabel="Venue"
      />
    </div>
  );
};

export default AdvancedProfileInsights;
