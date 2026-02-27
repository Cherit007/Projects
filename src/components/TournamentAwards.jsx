import React, { useMemo } from 'react';
import { Award, Crown, Medal, Star } from 'lucide-react';
import { computeTournamentAwards } from '../utils/tournamentAwards';

const TournamentAwards = ({
  teams = [],
  fixtures = [],
  bracket = [],
  finalMatch = null,
  champion = null,
  onSelectPlayer,
}) => {
  const awardsData = useMemo(() => computeTournamentAwards({
    teams,
    fixtures,
    bracket,
    finalMatch,
    champion,
  }), [teams, fixtures, bracket, finalMatch, champion]);

  if (!awardsData) return null;

  const { mvpRanking, awards } = awardsData;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 sm:p-6">
          <h3 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <Crown size={20} className="sm:w-6 sm:h-6" /> MVP Ranking
          </h3>
          <p className="text-indigo-100 text-xs sm:text-sm mt-1">
            Ranked by wins, point margin, clutch wins, and champion bonus.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="space-y-2">
            {mvpRanking.slice(0, 5).map((player, index) => (
              <button
                key={player.name}
                type="button"
                onClick={() => onSelectPlayer && onSelectPlayer(player.name)}
                className="w-full flex items-center justify-between rounded-lg border border-slate-200 px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm sm:text-base font-bold text-slate-600 w-6">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-slate-800 truncate">{player.name}</p>
                    <p className="text-xs text-slate-500">
                      W {player.wins} • Diff {player.pointDiff > 0 ? '+' : ''}{player.pointDiff} • Clutch {player.clutchWins}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold px-2 py-1 rounded-full">
                  <Star size={12} /> {player.mvpScore.toFixed(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {awards.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-md border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-slate-700 mb-2">
              <Award size={16} />
              <p className="font-bold text-sm">{item.title}</p>
            </div>
            <p className="text-lg font-semibold text-slate-800 mb-1">{item.emoji} {item.winner}</p>
            <p className="text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
        <p className="text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Medal size={14} /> Awards are calculated from completed matches in this tournament.
        </p>
      </div>
    </div>
  );
};

export default TournamentAwards;

