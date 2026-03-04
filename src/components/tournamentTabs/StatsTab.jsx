import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users } from 'lucide-react';
import PlayerAvatar from '../PlayerAvatar';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};

const StatsTab = ({
  isActive,
  tournamentFormat,
  playerStats,
  playerPhotos,
  setSelectedPlayerName,
}) => {
  if (!isActive || tournamentFormat !== 'league') return null;

  return (
    <motion.section
      key="tab-stats"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden tour-stats-card app-surface-card app-card-tier-primary app-rhythm-panel"
    >
      <div className="app-gradient-band p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
          <TrendingUp size={20} className="sm:w-6 sm:h-6" /> Player Statistics
        </h2>
      </div>
      {playerStats.length === 0 ? (
        <div className="p-8 sm:p-12 text-center text-gray-500">
          <Users size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
          <p className="text-sm sm:text-base">No match results yet. Complete matches to see player stats.</p>
        </div>
      ) : (
        <>
          <div className="mobile-leaderboard-cards p-3 sm:p-4">
            {playerStats.map((player, index) => (
              <article key={`stats-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                <div className="leaderboard-mobile-top">
                  <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                  <span className="leaderboard-stat-chip">{player.teamEmoji} {player.team}</span>
                </div>
                <div className="leaderboard-mobile-team">
                  <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerName(player.name)}
                      className="font-bold text-sm leading-tight text-left truncate"
                    >
                      {player.name}
                    </button>
                    <p className="text-xs opacity-75">{player.matchesWon} wins in {player.matchesPlayed} played</p>
                  </div>
                </div>
                <div className="leaderboard-mobile-metrics">
                  <span className="leaderboard-stat-chip">Played {player.matchesPlayed}</span>
                  <span className="leaderboard-stat-chip leaderboard-stat-chip-up">Won {player.matchesWon}</span>
                  <span className="leaderboard-stat-chip">Scored {player.totalScored}</span>
                </div>
                <div className="leaderboard-mobile-bottom">
                  <span className="leaderboard-form-chip leaderboard-form-chip-up">Win {player.winPercentage}%</span>
                </div>
              </article>
            ))}
          </div>

          <div className="dense-table-shell overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-100 sticky top-0 tour-table-head">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                  <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Played</th>
                  <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Won</th>
                  <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Win %</th>
                  <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Scored</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((player, index) => (
                  <tr key={player.name} className="tour-data-row border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                      <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-lg sm:text-xl">{player.teamEmoji}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                            <button
                              type="button"
                              onClick={() => setSelectedPlayerName(player.name)}
                              className="font-bold text-sm sm:text-base text-blue-700 hover:text-blue-900 hover:underline truncate text-left"
                            >
                              {player.name}
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{player.team}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{player.matchesWon}</td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                      <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm stats-win-badge">
                        {player.winPercentage}%
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-blue-600 text-sm">{player.totalScored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600 border-t border-gray-200 tour-stats-footnote">
            <p>📱 Swipe left to see all columns • Sorted by win percentage</p>
          </div>
        </>
      )}
    </motion.section>
  );
};

export default StatsTab;
