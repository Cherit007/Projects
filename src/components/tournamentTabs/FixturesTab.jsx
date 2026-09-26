import React, { useState } from 'react';
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
const MotionSection = motion.section;

const getWinnerName = (match) => {
  const score1 = Number(match?.score1);
  const score2 = Number(match?.score2);
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return '';
  return score1 > score2 ? match?.team1?.name : match?.team2?.name;
};

const getMatchPhaseLabel = (match) => (
  match?.label
  || (match?.round ? String(match.round).replace(/([a-z])([A-Z0-9])/g, '$1 $2') : '')
  || `Match ${match?.id || ''}`
);

const FixturesTab = ({
  isActive,
  tournamentFormat,
  currentMatch,
  onSaveMatchResult,
  nextMatches,
  onPrioritizeMatch,
  playerRatings,
  playerPhotos,
  pointsTable,
  tournamentHistory,
  casualMatches,
  getInlineSyncState,
  liveActivityEvents,
  fixtures,
  bracket,
  completedBracketMatches = [],
  totalBracketMatches = 0,
  selectedBracketMatch,
  setSelectedBracketMatch,
  onBracketMatchClick,
  onSaveBracketResult,
  leagueMatchesComplete,
  onGoToFinal,
}) => {
  if (!isActive) return null;

  const isLeague = tournamentFormat === 'league';
  const completedMatches = isLeague
    ? fixtures.filter((match) => match.completed)
    : completedBracketMatches;
  const totalMatchesCount = isLeague ? fixtures.length : totalBracketMatches;
  const onSaveScore = isLeague ? onSaveMatchResult : onSaveBracketResult;
  const [expandedCompletedMatchId, setExpandedCompletedMatchId] = useState(null);

  return (
    <MotionSection
      key="tab-fixtures"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-3 sm:space-y-4"
    >
      {currentMatch && (
        <LiveMatchView
          currentMatch={currentMatch}
          onSaveScore={onSaveScore}
          nextMatches={nextMatches}
          onSelectUpcomingMatch={onPrioritizeMatch}
          playerRatings={playerRatings}
          playerPhotos={playerPhotos}
          pointsTable={pointsTable}
          tournamentHistory={tournamentHistory}
          casualMatches={casualMatches}
          syncState={getInlineSyncState(currentMatch?.id, isLeague ? 'score' : 'bracket')}
          completedMatchesCount={completedMatches.length}
          totalMatchesCount={totalMatchesCount}
        />
      )}

      {!isLeague && !currentMatch && (
        <div className="variant-a-card">
          <p className="variant-a-section-label">Playoffs</p>
          <p className="variant-a-meta-copy">
            {completedMatches.length >= totalMatchesCount && totalMatchesCount > 0
              ? 'All playoff matches are complete.'
              : 'Waiting for the next playoff matchup to unlock.'}
          </p>
        </div>
      )}

      {completedMatches.length > 0 && (
        <div className="variant-a-card variant-a-progress-card">
          <div className="variant-a-progress-head">
            <span className="variant-a-progress-title">Match progress</span>
            <span className="variant-a-meta-copy">{completedMatches.length} / {totalMatchesCount}</span>
          </div>
          <div className="variant-a-progress-bar">
            <span
              className="variant-a-progress-fill"
              style={{ width: `${totalMatchesCount > 0 ? (completedMatches.length / totalMatchesCount) * 100 : 0}%` }}
            />
          </div>
          <div className="variant-a-progress-copy">
            {completedMatches.map((match) => (
              <span key={`progress-${match.id}`}>✓ M{match.id}</span>
            ))}
            {currentMatch && <span>● M{currentMatch.id} live</span>}
            {nextMatches.map((match) => (
              <span key={`pending-${match.id}`}>○ M{match.id}</span>
            ))}
          </div>
        </div>
      )}

      {completedMatches.length > 0 && (
        <div className="variant-a-card completed-matches-section">
          <div className="variant-a-history-head">
            <p className="variant-a-section-label !mb-0">Completed ({completedMatches.length})</p>
          </div>
          <div className="space-y-3">
            {completedMatches.map((match) => (
              <div key={match.id} className="space-y-3">
                <button
                  type="button"
                  onClick={() => setExpandedCompletedMatchId((current) => (current === match.id ? null : match.id))}
                  className="variant-a-history-row variant-a-history-row-action variant-a-history-row-card"
                >
                  <div>
                    <p className="variant-a-history-title">{match.team1?.name} vs {match.team2?.name}</p>
                    <p className="variant-a-history-copy">
                      {isLeague
                        ? `Round ${match.round} · ${match.score1}-${match.score2}`
                        : `${getMatchPhaseLabel(match)} · ${match.score1}-${match.score2}`}
                    </p>
                  </div>
                  <div className="variant-a-history-right">
                    <span className="variant-a-done-badge">✓ Done</span>
                    <p className="variant-a-history-winner">{getWinnerName(match)} won</p>
                  </div>
                </button>
                {expandedCompletedMatchId === match.id && (
                  isLeague ? (
                    <MatchCard
                      match={match}
                      onSave={onSaveMatchResult}
                      syncState={getInlineSyncState(match?.id, 'score')}
                    />
                  ) : (
                    <button
                      type="button"
                      className="variant-a-pending-box w-full text-left"
                      onClick={() => setSelectedBracketMatch(match)}
                    >
                      <p className="variant-a-pending-label">Edit result</p>
                      <p className="variant-a-pending-matchup">{match.score1}-{match.score2}</p>
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <LiveActivityFeed events={liveActivityEvents} />

      {isLeague && leagueMatchesComplete && (
        <div className="variant-a-card league-complete-banner rounded-2xl p-6 text-center">
          <Trophy size={36} className="mx-auto mb-3 league-complete-icon" />
          <p className="text-base font-bold league-complete-title">All league matches completed!</p>
          <p className="text-xs mt-2 league-complete-subtitle">Top 2 teams will play in the final</p>
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

      {!isLeague && (
        <>
          <BracketView
            bracket={bracket}
            onMatchClick={onBracketMatchClick || ((match) => setSelectedBracketMatch(match))}
          />
          {selectedBracketMatch && (
            <BracketMatchModal
              match={selectedBracketMatch}
              onSave={onSaveBracketResult}
              onClose={() => setSelectedBracketMatch(null)}
            />
          )}
        </>
      )}
    </MotionSection>
  );
};

export default FixturesTab;
