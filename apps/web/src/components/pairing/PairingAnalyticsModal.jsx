import React from 'react';
import { X, Sparkles, Users, Shuffle } from 'lucide-react';

const PairTable = ({ title, rows, emptyText, scoreLabel }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
    <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-gray-500">{emptyText}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-2">Pair</th>
              <th className="py-1.5 px-2 text-center">Played</th>
              <th className="py-1.5 px-2 text-center">W-L</th>
              <th className="py-1.5 px-2 text-center">Win %</th>
              <th className="py-1.5 pl-2 text-right">{scoreLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.pairKey} className="border-b border-gray-100 last:border-b-0">
                <td className="py-1.5 pr-2 font-semibold text-gray-800">{row.pairLabel}</td>
                <td className="py-1.5 px-2 text-center">{row.playedTogether ?? row.played}</td>
                <td className="py-1.5 px-2 text-center">{row.wins ?? '-'}{row.losses !== undefined ? `-${row.losses}` : ''}</td>
                <td className="py-1.5 px-2 text-center">{row.winRate ? `${row.winRate}%` : '-'}</td>
                <td className="py-1.5 pl-2 text-right font-bold text-blue-700">
                  {row.recommendationScore ?? row.chemistryScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const PairingAnalyticsModal = ({ analytics, onClose }) => {
  if (!analytics) return null;

  return (
    <div className="fixed inset-0 z-[240] bg-black bg-opacity-50 flex items-center justify-center p-4 app-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden setup-pairing-modal-shell app-modal-shell">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-4 sm:p-5 flex items-center justify-between setup-modal-header setup-modal-header-pairing">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate flex items-center gap-2">
              <Sparkles size={18} /> Team & Pairing Analytics
            </h3>
            <p className="text-xs sm:text-sm text-cyan-100 truncate">
              Doubles matches tracked: {analytics.totalDoublesMatches} • Unique pairs: {analytics.totalTrackedPairs}
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
          <PairTable
            title="Best Doubles Combinations"
            rows={analytics.bestCombinations || []}
            emptyText="Not enough doubles history yet."
            scoreLabel="Chemistry"
          />

          <PairTable
            title="Who Should Pair With Whom"
            rows={analytics.whoShouldPair || []}
            emptyText="Not enough player data yet."
            scoreLabel="Recommendation"
          />

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Shuffle size={15} /> Rotation Suggestions
            </p>
            {(analytics.rotationSuggestions || []).length === 0 ? (
              <p className="text-xs text-gray-500">No rotation suggestions yet. Add more doubles results.</p>
            ) : (
              <div className="space-y-2">
                {analytics.rotationSuggestions.map((item, index) => (
                  <div key={`${item.type}-${index}`} className="bg-white border border-gray-200 rounded-lg p-2.5 sm:p-3">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Users size={14} className="text-blue-600" /> {item.title}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PairingAnalyticsModal;
