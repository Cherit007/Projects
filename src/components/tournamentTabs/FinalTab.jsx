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
const MotionSection = motion.section;

const ChampionCore = ({
  champion,
  championBurstActive,
  championConfettiPieces,
  confettiKeyPrefix,
}) => (
  <div className="variant-a-card variant-a-champion-card champion-burst-host">
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
    <div className="variant-a-champion-emoji">{champion.emoji}</div>
    <h3 className="variant-a-champion-title">{champion.name}</h3>
    <p className="variant-a-champion-roster">
      {champion.player || champion.player1}
      {champion.player2 && ` & ${champion.player2}`}
    </p>
    <div className="variant-a-champion-badge">🥇 CHAMPIONS!</div>
  </div>
);

const FinalPreview = ({ finalists }) => {
  if (!finalists || finalists.length < 2) return null;

  return (
    <div className="variant-a-card">
      <p className="variant-a-section-label">Final bracket</p>
      <div className="variant-a-bracket-stack">
        <div>
          <p className="variant-a-bracket-label">Grand final</p>
          <div className="variant-a-pending-box">
            <p className="variant-a-pending-label">Top 2 teams battle for the title</p>
            <p className="variant-a-pending-matchup">{finalists[0].name} vs {finalists[1].name}</p>
            <p className="variant-a-meta-copy">Unlocks now</p>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    <MotionSection
      key="tab-final"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-3 sm:space-y-4"
    >
      {tournamentFormat === 'league' ? (
        <>
          {champion ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="variant-a-card text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h2 className="text-lg font-bold text-white mb-1">Tournament Complete!</h2>
                <p className="variant-a-section-label !mb-3 text-center">Tournament complete</p>
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
                <div className="variant-a-card">
                  <p className="variant-a-section-label">Odd player eligible for final</p>
                  <p className="variant-a-meta-copy">{finalSelection.oddPlayerReason}</p>
                </div>
              )}
              <FinalPreview finalists={finalSelection.finalists} />
              <FinalMatchCard
                finalists={finalSelection.finalists}
                onSave={handleSaveFinalResult}
                playerRatings={playerRatings}
                syncState={getInlineSyncState('final', 'final')}
              />
            </>
          ) : (
            <div className="variant-a-card text-center">
              <Trophy size={36} className="mx-auto text-yellow-400 mb-3" />
              <p className="variant-a-section-label !mb-1 text-center">Complete all league matches first</p>
              <p className="variant-a-meta-copy">{fixtures.filter((f) => f.completed).length} / {fixtures.length} matches completed</p>
            </div>
          )}
        </>
      ) : (
        <>
          {champion ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="variant-a-card text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h2 className="text-lg font-bold text-white mb-1">Tournament Complete!</h2>
                <p className="variant-a-section-label !mb-3 text-center">Tournament complete</p>
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
            <div className="variant-a-card text-center">
              <Trophy size={36} className="mx-auto text-yellow-400 mb-3" />
              <p className="variant-a-section-label !mb-1 text-center">Bracket in progress</p>
              <p className="variant-a-meta-copy">Complete all matches to determine the champion.</p>
            </div>
          )}
        </>
      )}
    </MotionSection>
  );
};

export default FinalTab;
