import React from 'react';
import BoxCricketScorer from './BoxCricketScorer';

const BoxCricketLiveMatchView = ({
  currentMatch,
  onSaveScore,
  sportId = 'boxCricket',
  ruleConfig = {},
  syncState = null,
  completedMatchesCount = 0,
  totalMatchesCount = 0,
}) => (
  <BoxCricketScorer
    team1={currentMatch?.team1}
    team2={currentMatch?.team2}
    ruleConfig={ruleConfig}
    onSaveScore={onSaveScore}
    matchId={currentMatch?.id}
    syncState={syncState}
    completedMatchesCount={completedMatchesCount}
    totalMatchesCount={totalMatchesCount}
    title={`Live match · ${sportId === 'boxCricket' ? 'Box Cricket' : 'Cricket'}`}
    requireScoringModePick
  />
);

export default BoxCricketLiveMatchView;
