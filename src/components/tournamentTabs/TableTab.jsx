import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, Trophy } from 'lucide-react';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};

const TableTab = ({
  isActive,
  tournamentFormat,
  pointsTable,
  pointsTableRankMovement,
  getTeamFormMeta,
}) => {
  if (!isActive || tournamentFormat !== 'league') return null;

  return (
    <motion.section
      key="tab-table"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden tour-points-card app-surface-card app-card-tier-primary app-rhythm-panel"
    >
      <div className="app-gradient-band p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
          <Trophy size={20} className="sm:w-6 sm:h-6" /> Points Table
        </h2>
      </div>

      <LayoutGroup id="points-table-layout">
        <div className="mobile-leaderboard-cards p-3 sm:p-4">
          {pointsTable.map((team, index) => {
            const movement = pointsTableRankMovement.get(String(team.id));
            const movementDirection = movement ? (movement.delta > 0 ? 'up' : 'down') : 'neutral';
            const formMeta = getTeamFormMeta(team.id);
            const pointDiff = Number(team?.scoreDiff || 0);
            return (
              <motion.article
                key={`table-card-${team.id}`}
                layout
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.65 }}
                className={`leaderboard-mobile-card app-surface-card app-card-tier-secondary ${movement ? `table-rank-flash table-rank-flash-${movementDirection}` : ''}`}
              >
                <div className="leaderboard-mobile-top">
                  <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                  {movement ? (
                    <span className={`leaderboard-move-chip leaderboard-move-chip-${movementDirection}`}>
                      {movement.delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      <span>{Math.abs(movement.delta)}</span>
                    </span>
                  ) : (
                    <span className="leaderboard-move-chip leaderboard-move-chip-neutral">
                      <Minus size={13} />
                      <span>0</span>
                    </span>
                  )}
                </div>
                <div className="leaderboard-mobile-team">
                  <span className="text-xl">{team.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight truncate">{team.name}</p>
                    <p className="text-xs opacity-80 truncate">{team.player || team.player1}{team.player2 && ` & ${team.player2}`}</p>
                  </div>
                </div>
                <div className="leaderboard-mobile-metrics">
                  <span className="leaderboard-stat-chip">Pts {team.points}</span>
                  <span className={`leaderboard-stat-chip ${pointDiff > 0 ? 'leaderboard-stat-chip-up' : pointDiff < 0 ? 'leaderboard-stat-chip-down' : ''}`}>
                    Diff {pointDiff > 0 ? '+' : ''}{pointDiff}
                  </span>
                  <span className={`leaderboard-stat-chip ${(team.netMatchRate || 0) > 0 ? 'leaderboard-stat-chip-up' : (team.netMatchRate || 0) < 0 ? 'leaderboard-stat-chip-down' : ''}`}>
                    NMR {(team.netMatchRate || 0) > 0 ? '+' : ''}{(team.netMatchRate || 0).toFixed(2)}
                  </span>
                </div>
                <div className="leaderboard-mobile-bottom">
                  <span className={`leaderboard-form-chip leaderboard-form-chip-${formMeta.tone}`}>Form {formMeta.label}</span>
                  <span className="text-[11px] opacity-75">W {team.won} • L {team.lost} • P {team.played}</span>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="dense-table-shell overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-100 tour-table-head">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Team</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">P</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">W</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">L</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Pts</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Diff</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">NMR</th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Form</th>
              </tr>
            </thead>
            <tbody>
              {pointsTable.map((team, index) => {
                const movement = pointsTableRankMovement.get(String(team.id));
                const movementDirection = movement ? (movement.delta > 0 ? 'up' : 'down') : '';
                const formMeta = getTeamFormMeta(team.id);
                const pointDiff = Number(team?.scoreDiff || 0);
                return (
                  <motion.tr
                    layout
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.65 }}
                    key={team.id}
                    className={`tour-data-row border-b border-gray-200 hover:bg-gray-50 ${index < 2 ? 'points-top-two-row' : ''} ${movement ? `table-rank-flash table-rank-flash-${movementDirection}` : ''}`}
                  >
                    <td className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className="table-rank-cell">
                        <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                        {movement && (
                          <span
                            className={`table-rank-chip table-rank-chip-${movementDirection}`}
                            title={`Moved from #${movement.previousRank} to #${movement.nextRank}`}
                          >
                            {movement.delta > 0 ? '▲' : '▼'} {Math.abs(movement.delta)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-lg sm:text-2xl">{team.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{team.name}</p>
                          <p className="text-xs text-gray-600 truncate">{team.player || team.player1}{team.player2 && ` & ${team.player2}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{team.played}</td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{team.won}</td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-red-600 text-sm">{team.lost}</td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm points-chip">{team.points}</span>
                    </td>
                    <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-sm ${pointDiff > 0 ? 'text-green-600' : pointDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {pointDiff > 0 ? '+' : ''}{pointDiff}
                    </td>
                    <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-sm ${(team.netMatchRate || 0) > 0 ? 'text-green-600' : (team.netMatchRate || 0) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {(team.netMatchRate || 0) > 0 ? '+' : ''}{(team.netMatchRate || 0).toFixed(2)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                      <span className={`leaderboard-form-chip leaderboard-form-chip-${formMeta.tone}`}>{formMeta.label}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LayoutGroup>
      <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
        <p>Top 2 teams qualify for the final • Win = 2 points • Tiebreaker: NMR (average point difference per match)</p>
      </div>
    </motion.section>
  );
};

export default TableTab;
