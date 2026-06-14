import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import LiveMatchView from '../LiveMatchView';
import BoxCricketLiveMatchView from '../boxCricket/BoxCricketLiveMatchView';
import MatchSchedulePanel from '../boxCricket/MatchSchedulePanel';
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

const FixturesTab = ({
  isActive,
  sportId,
  ruleConfig,
  tournamentFormat,
  currentMatch,
  onSaveMatchResult,
  onUpdateMatchSchedule,
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
  selectedBracketMatch,
  setSelectedBracketMatch,
  onSaveBracketResult,
  leagueMatchesComplete,
  onGoToFinal,
}) => {
  if (!isActive) return null;

  const completedMatches = fixtures.filter((match) => match.completed);
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
      {tournamentFormat === 'league' ? (
        <>
          {currentMatch && (
            sportId === 'boxCricket' ? (
              <BoxCricketLiveMatchView
                currentMatch={currentMatch}
                onSaveScore={onSaveMatchResult}
                sportId={sportId}
                ruleConfig={ruleConfig}
                syncState={getInlineSyncState(currentMatch?.id, 'score')}
                completedMatchesCount={completedMatches.length}
                totalMatchesCount={fixtures.length}
              />
            ) : (
            <LiveMatchView
              currentMatch={currentMatch}
              onSaveScore={onSaveMatchResult}
              nextMatches={nextMatches}
              onSelectUpcomingMatch={onPrioritizeMatch}
              playerRatings={playerRatings}
              playerPhotos={playerPhotos}
              pointsTable={pointsTable}
              tournamentHistory={tournamentHistory}
              casualMatches={casualMatches}
              syncState={getInlineSyncState(currentMatch?.id, 'score')}
              completedMatchesCount={completedMatches.length}
              totalMatchesCount={fixtures.length}
              sportId={sportId}
              ruleConfig={ruleConfig}
            />
            )
          )}

          {currentMatch && typeof onUpdateMatchSchedule === 'function' && (
            <MatchSchedulePanel
              match={currentMatch}
              fixtures={fixtures}
              onSaveSchedule={onUpdateMatchSchedule}
            />
          )}

          {completedMatches.length > 0 && (
            <div className="variant-a-card variant-a-progress-card">
              <div className="variant-a-progress-head">
                <span className="variant-a-progress-title">Match progress</span>
                <span className="variant-a-meta-copy">{completedMatches.length} / {fixtures.length}</span>
              </div>
              <div className="variant-a-progress-bar">
                <span
                  className="variant-a-progress-fill"
                  style={{ width: `${fixtures.length > 0 ? (completedMatches.length / fixtures.length) * 100 : 0}%` }}
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
                        <p className="variant-a-history-copy">Round {match.round} · {match.score1}-{match.score2}</p>
                      </div>
                      <div className="variant-a-history-right">
                        <span className="variant-a-done-badge">✓ Done</span>
                        <p className="variant-a-history-winner">{getWinnerName(match)} won</p>
                      </div>
                    </button>
                    {expandedCompletedMatchId === match.id && (
                      <MatchCard
                        match={match}
                        onSave={onSaveMatchResult}
                        syncState={getInlineSyncState(match?.id, 'score')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <LiveActivityFeed events={liveActivityEvents} />

          {leagueMatchesComplete && (
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
    </MotionSection>
  );
};

export default FixturesTab;
