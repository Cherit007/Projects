import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import LiveMatchView from '../LiveMatchView';
import MatchCard from '../MatchCard';
import BracketView from '../BracketView';
import BracketMatchModal from '../Bracketmatchmodal';
import LiveActivityFeed from '../LiveActivityFeed';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};

const FixturesTab = ({
  isActive,
  tournamentFormat,
  currentMatch,
  onSaveMatchResult,
  nextMatches,
  onPrioritizeMatch,
  tournamentName,
  playerRatings,
  playerPhotos,
  pointsTable,
  tournamentHistory,
  casualMatches,
  getInlineSyncState,
  liveActivityEvents,
  fixtures,
  bracket,
  selectedBracketMatch,
  setSelectedBracketMatch,
  onSaveBracketResult,
  leagueMatchesComplete,
  onGoToFinal,
}) => {
  if (!isActive) return null;

  const completedMatches = fixtures.filter((match) => match.completed);

  return (
    <motion.section
      key="tab-fixtures"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {tournamentFormat === 'league' ? (
        <>
          {currentMatch && (
            <LiveMatchView
              currentMatch={currentMatch}
              onSaveScore={onSaveMatchResult}
              nextMatches={nextMatches}
              onSelectUpcomingMatch={onPrioritizeMatch}
              tournamentName={tournamentName}
              playerRatings={playerRatings}
              playerPhotos={playerPhotos}
              pointsTable={pointsTable}
              tournamentHistory={tournamentHistory}
              casualMatches={casualMatches}
              syncState={getInlineSyncState(currentMatch?.id, 'score')}
            />
          )}

          <LiveActivityFeed events={liveActivityEvents} />

          {completedMatches.length > 0 && (
            <div className="completed-matches-section">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 completed-matches-title">
                <Trophy size={20} className="completed-matches-icon" />
                Completed Matches ({completedMatches.length}/{fixtures.length})
              </h3>
              <div className="space-y-4">
                {completedMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onSave={onSaveMatchResult}
                    syncState={getInlineSyncState(match?.id, 'score')}
                  />
                ))}
              </div>
            </div>
          )}

          {leagueMatchesComplete && (
            <div className="league-complete-banner rounded-2xl p-6 text-center">
              <Trophy size={48} className="mx-auto mb-3 league-complete-icon" />
              <p className="text-lg font-bold league-complete-title">All league matches completed!</p>
              <p className="text-sm mt-2 league-complete-subtitle">Top 2 teams will play in the final</p>
              {typeof onGoToFinal === 'function' && (
                <button
                  type="button"
                  onClick={onGoToFinal}
                  className="league-complete-cta mt-4"
                >
                  Open Final
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <LiveActivityFeed events={liveActivityEvents} />
          <BracketView bracket={bracket} onMatchClick={(match) => setSelectedBracketMatch(match)} />
          {selectedBracketMatch && (
            <BracketMatchModal
              match={selectedBracketMatch}
              onSave={onSaveBracketResult}
              onClose={() => setSelectedBracketMatch(null)}
            />
          )}
        </>
      )}
    </motion.section>
  );
};

export default FixturesTab;
