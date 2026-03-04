import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import FinalMatchCard from '../FinalMatchCard';
import TournamentAwards from '../TournamentAwards';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};

const ChampionCore = ({
  champion,
  championBurstActive,
  championConfettiPieces,
  confettiKeyPrefix,
}) => (
  <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto tour-final-champion-core champion-burst-host">
    <div className={`champion-confetti-burst ${championBurstActive ? 'is-active' : ''}`} aria-hidden="true">
      {championConfettiPieces.map((piece) => (
        <span
          key={`${confettiKeyPrefix}-${piece.id}`}
          className="champion-confetti-piece"
          style={{
            '--burst-x': `${piece.x}%`,
            '--burst-delay': `${piece.delay}ms`,
            '--burst-rotation': `${piece.rotation}deg`,
            '--burst-hue': String(piece.hue),
          }}
        />
      ))}
    </div>
    <div className="text-4xl sm:text-5xl mb-3 tour-final-champion-emoji">{champion.emoji}</div>
    <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 tour-final-champion-title">{champion.name}</h3>
    <p className="text-sm sm:text-base text-gray-600 tour-final-champion-roster">
      {champion.player || champion.player1}
      {champion.player2 && ` & ${champion.player2}`}
    </p>
    <div className="mt-4 bg-yellow-100 rounded-lg py-2 tour-final-champion-badge">
      <p className="text-base sm:text-lg font-bold text-gray-800 tour-final-champion-badge-text">🥇 CHAMPIONS!</p>
    </div>
  </div>
);

const FinalTab = ({
  isActive,
  tournamentFormat,
  champion,
  teams,
  fixtures,
  bracket,
  completedTournamentRecord,
  championBurstActive,
  championConfettiPieces,
  setSelectedPlayerName,
  leagueMatchesComplete,
  finalSelection,
  handleSaveFinalResult,
  getInlineSyncState,
  playerRatings,
}) => {
  if (!isActive) return null;

  return (
    <motion.section
      key="tab-final"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {tournamentFormat === 'league' ? (
        <>
          {champion ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center tour-final-panel app-surface-card app-card-tier-primary app-screen-final app-rhythm-panel">
                <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 app-section-heading">Tournament Complete!</h2>
                <ChampionCore
                  champion={champion}
                  championBurstActive={championBurstActive}
                  championConfettiPieces={championConfettiPieces}
                  confettiKeyPrefix="league-burst"
                />
              </div>
              <TournamentAwards
                teams={teams}
                fixtures={fixtures}
                bracket={[]}
                finalMatch={completedTournamentRecord?.finalMatch || null}
                champion={champion}
                onSelectPlayer={(name) => setSelectedPlayerName(name)}
              />
            </div>
          ) : leagueMatchesComplete ? (
            <>
              {finalSelection.oddPlayerIncluded && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800 tour-final-odd-banner">
                  <p className="text-sm font-semibold">Odd Player Eligible for Final</p>
                  <p className="text-xs mt-1">{finalSelection.oddPlayerReason}</p>
                </div>
              )}
              <FinalMatchCard
                finalists={finalSelection.finalists}
                onSave={handleSaveFinalResult}
                playerRatings={playerRatings}
                syncState={getInlineSyncState('final', 'final')}
              />
            </>
          ) : (
            <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center tour-final-panel app-surface-card app-card-tier-primary app-screen-final app-rhythm-panel">
              <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
              <p className="text-base sm:text-lg text-gray-500 mb-4">Complete all league matches first</p>
              <p className="text-sm text-gray-400">
                {fixtures.filter((f) => f.completed).length} / {fixtures.length} matches completed
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center tour-final-panel app-surface-card app-card-tier-primary app-screen-final app-rhythm-panel">
          <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
          {champion ? (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 app-section-heading">Tournament Complete!</h2>
                <ChampionCore
                  champion={champion}
                  championBurstActive={championBurstActive}
                  championConfettiPieces={championConfettiPieces}
                  confettiKeyPrefix="knockout-burst"
                />
              </div>
              <TournamentAwards
                teams={teams}
                fixtures={fixtures}
                bracket={bracket}
                finalMatch={completedTournamentRecord?.finalMatch || null}
                champion={champion}
                onSelectPlayer={(name) => setSelectedPlayerName(name)}
              />
            </div>
          ) : (
            <div>
              <p className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Bracket in Progress</p>
              <p className="text-sm sm:text-base text-gray-600">Complete all matches to determine the champion</p>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
};

export default FinalTab;
