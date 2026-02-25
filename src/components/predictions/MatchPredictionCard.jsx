import React from 'react';

const pct = (value) => `${Math.round((value || 0) * 100)}%`;

const MatchPredictionCard = ({ match, prediction, title = 'Pre-Match Prediction', compact = false }) => {
  if (!match?.team1 || !match?.team2 || !prediction) return null;

  const team1Pct = prediction.team1Probability || 0.5;
  const team2Pct = prediction.team2Probability || 0.5;
  const favorite = prediction.favorite === 'team1' ? match.team1.name : match.team2.name;

  return (
    <div className={`bg-indigo-50 border border-indigo-200 rounded-xl ${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}>
      <p className={`font-semibold text-indigo-900 ${compact ? 'text-xs' : 'text-sm'} mb-2`}>{title}</p>

      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
        <span className="truncate pr-2">{match.team1.name}</span>
        <span className="text-indigo-700">{pct(team1Pct)}</span>
      </div>
      <div className="w-full bg-white rounded-full h-2 overflow-hidden mb-2">
        <div className="bg-indigo-600 h-2" style={{ width: `${team1Pct * 100}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
        <span className="truncate pr-2">{match.team2.name}</span>
        <span className="text-indigo-700">{pct(team2Pct)}</span>
      </div>
      <div className="w-full bg-white rounded-full h-2 overflow-hidden">
        <div className="bg-cyan-600 h-2" style={{ width: `${team2Pct * 100}%` }} />
      </div>

      <div className={`mt-2 text-[11px] sm:text-xs text-gray-600 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
        <p><span className="font-semibold">Favorite:</span> {favorite}</p>
        <p>
          <span className="font-semibold">H2H:</span>{' '}
          {prediction.h2h.sampleSize > 0
            ? `${prediction.h2h.team1Wins}-${prediction.h2h.team2Wins}`
            : 'No direct history'}
        </p>
      </div>
    </div>
  );
};

export default MatchPredictionCard;
