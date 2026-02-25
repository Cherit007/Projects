import React from 'react';
import { X, BarChart3, Flame, CalendarDays } from 'lucide-react';

const rankBadge = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
};

const MainLeaderboard = ({ rows }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
    <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
      <Flame size={15} className="text-orange-600" /> Power Rankings
    </p>
    {rows.length === 0 ? (
      <p className="text-xs text-gray-500">No ranking data yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-2">Rank</th>
              <th className="py-1.5 px-2">Player</th>
              <th className="py-1.5 px-2 text-center">Rating</th>
              <th className="py-1.5 px-2 text-center">Weighted ELO</th>
              <th className="py-1.5 px-2 text-center">Trend</th>
              <th className="py-1.5 px-2 text-center">Last 5</th>
              <th className="py-1.5 px-2 text-center">Last 10</th>
              <th className="py-1.5 pl-2 text-right">Power</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name} className="border-b border-gray-100 last:border-b-0">
                <td className="py-1.5 pr-2 font-semibold">{rankBadge(row.rank)}</td>
                <td className="py-1.5 px-2 font-semibold text-gray-800">{row.name}</td>
                <td className="py-1.5 px-2 text-center">{row.rating}</td>
                <td className="py-1.5 px-2 text-center font-semibold text-blue-700">{row.weightedElo}</td>
                <td className="py-1.5 px-2 text-center font-bold">{row.trendSymbol}</td>
                <td className="py-1.5 px-2 text-center">{row.last5Form || '-'}</td>
                <td className="py-1.5 px-2 text-center">{row.last10Form || '-'}</td>
                <td className="py-1.5 pl-2 text-right font-bold text-indigo-700">{row.powerScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const PeriodLeaderboard = ({ title, rows }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
    <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
      <CalendarDays size={15} className="text-teal-600" /> {title}
    </p>
    {rows.length === 0 ? (
      <p className="text-xs text-gray-500">No matches in this period yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-2">Player</th>
              <th className="py-1.5 px-2 text-center">Matches</th>
              <th className="py-1.5 px-2 text-center">W-L</th>
              <th className="py-1.5 px-2 text-center">Win %</th>
              <th className="py-1.5 pl-2 text-right">Net Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map(row => (
              <tr key={row.name} className="border-b border-gray-100 last:border-b-0">
                <td className="py-1.5 pr-2 font-semibold text-gray-800">{row.name}</td>
                <td className="py-1.5 px-2 text-center">{row.matches}</td>
                <td className="py-1.5 px-2 text-center">{row.wins}-{row.losses}</td>
                <td className="py-1.5 px-2 text-center">{row.winRate}%</td>
                <td className={`py-1.5 pl-2 text-right font-semibold ${row.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {row.netChange >= 0 ? '+' : ''}{row.netChange}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const FormPowerRankingsModal = ({ rankings, onClose }) => {
  if (!rankings) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-4 sm:p-5 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate flex items-center gap-2">
              <BarChart3 size={18} /> Form & Power Rankings
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 truncate">
              Weighted ELO + recent form + momentum trends
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(90vh-84px)] space-y-4">
          <MainLeaderboard rows={rankings.leaderboard || []} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeriodLeaderboard title="Weekly Leaderboard (Last 7 Days)" rows={rankings.weeklyLeaderboard || []} />
            <PeriodLeaderboard title="Monthly Leaderboard (Last 30 Days)" rows={rankings.monthlyLeaderboard || []} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPowerRankingsModal;
