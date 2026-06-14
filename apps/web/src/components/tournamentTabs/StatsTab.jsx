import React from 'react';
import { motion } from 'framer-motion';
import PlayerAvatar from '../PlayerAvatar';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};
const MotionSection = motion.section;

const StatsTab = ({
  isActive,
  tournamentFormat,
  playerStats,
  playerPhotos,
  playerRatings = {},
  setSelectedPlayerName,
}) => {
  if (!isActive || tournamentFormat !== 'league') return null;

  return (
    <MotionSection
      key="tab-stats"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="variant-a-card"
    >
      <p className="variant-a-section-label">Player stats</p>

      {playerStats.length === 0 ? (
        <div className="variant-a-empty-card">
          <p>No match results yet. Complete matches to see player stats.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playerStats.map((player) => {
            const rating = Number(playerRatings?.[player.name]?.rating || 1000);
            const avgPoints = player.matchesPlayed > 0
              ? (Number(player.totalScored || 0) / Number(player.matchesPlayed || 1)).toFixed(1)
              : '—';
            const tournamentsPlayed = Number(player?.tournamentsPlayed || 0);
            const championships = Number(player?.championships || 0);
            const contextLabel = String(player?.team || '').trim()
              || (championships > 0
                ? `${tournamentsPlayed} tournament${tournamentsPlayed === 1 ? '' : 's'} • ${championships} title${championships === 1 ? '' : 's'}`
                : tournamentsPlayed > 0
                  ? `${tournamentsPlayed} tournament${tournamentsPlayed === 1 ? '' : 's'} tracked`
                  : 'Current form');

            return (
              <article key={player.name} className="variant-a-stat-card">
                <div className="variant-a-stat-head">
                  <div className="variant-a-stat-player">
                    <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="md" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedPlayerName(player.name)}
                        className="variant-a-stat-name"
                      >
                        {player.name}
                      </button>
                      <p className="variant-a-stat-team">{contextLabel}</p>
                    </div>
                  </div>
                  <div className="variant-a-stat-elo">{rating} ELO</div>
                </div>

                <div className="variant-a-stat-grid">
                  <div className="variant-a-stat-box">
                    <p className="variant-a-stat-value">{player.matchesPlayed}</p>
                    <p className="variant-a-stat-label">Matches</p>
                  </div>
                  <div className="variant-a-stat-box">
                    <p className="variant-a-stat-value">{player.matchesPlayed > 0 ? `${player.winPercentage}%` : '—'}</p>
                    <p className="variant-a-stat-label">Win rate</p>
                  </div>
                  <div className="variant-a-stat-box">
                    <p className="variant-a-stat-value">{player.matchesPlayed > 0 ? player.totalScored : '—'}</p>
                    <p className="variant-a-stat-label">Pts scored</p>
                  </div>
                  <div className="variant-a-stat-box">
                    <p className="variant-a-stat-value">{player.matchesPlayed > 0 ? avgPoints : '—'}</p>
                    <p className="variant-a-stat-label">Avg pts</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </MotionSection>
  );
};

export default StatsTab;
