import React, { useMemo, useState } from 'react';
import { Trophy, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  buildBoxCricketMatchStatistics,
  getBoxCricketRulesSummary,
  isBoxCricketInningsTied,
  resolveBoxCricketRules,
  validateBoxCricketMatchSubmission,
} from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import {
  createBallByBallInningsState,
  isInningsComplete,
} from '@fixture-maker/domain/sports/boxCricket/ballByBallScoring';
import {
  isTossComplete,
  resolveBattingOrder,
} from '@fixture-maker/domain/sports/boxCricket/matchSetup';
import { normalizeSquad } from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import BoxCricketSummaryScorePanel from './BoxCricketSummaryScorePanel';
import BoxCricketBallByBallPanel, { inningsStateToSummary as mapInningsState } from './BoxCricketBallByBallPanel';
import BoxCricketScoringModePanel from './BoxCricketScoringModePanel';
import BoxCricketTossPanel from './BoxCricketTossPanel';
import { hapticError, hapticSubmit, hapticSuccess } from '../../utils/haptics';

const emptyInnings = (oversLimit) => ({ runs: '', wickets: '0', overs: String(oversLimit) });

const squadToBatters = (team) => normalizeSquad(team?.squad).map((player) => ({
  id: player.id,
  name: player.name,
}));

const draftBallStateMatchesRules = (draftScorer, oversLimit) => {
  const storedLimit = draftScorer?.innings1BallState?.oversLimit;
  if (!draftScorer?.innings1BallState) return true;
  return Number(storedLimit) === Number(oversLimit);
};

const BoxCricketScorer = ({
  team1,
  team2,
  ruleConfig = {},
  onSaveScore,
  matchId = null,
  syncState = null,
  completedMatchesCount = 0,
  totalMatchesCount = 0,
  title = 'Live match · Box Cricket',
  initialScoringMode = 'summary',
  lockScoringMode = false,
  requireScoringModePick = false,
  submitLabel = null,
  matchToss = null,
  requireToss = true,
  draftScorer = null,
  onScorerSnapshotChange = null,
  onRematch = null,
  rematchLabel = 'Start new match with same teams',
}) => {
  const rules = useMemo(() => resolveBoxCricketRules(ruleConfig), [ruleConfig]);
  const canRestoreDraftBallState = draftBallStateMatchesRules(draftScorer, rules.oversLimit);
  const [localToss, setLocalToss] = useState(() => (
    matchToss?.tossWinnerTeamId
      ? { tossWinnerTeamId: matchToss.tossWinnerTeamId, electedTo: matchToss.electedTo || 'bat' }
      : { tossWinnerTeamId: null, electedTo: null }
  ));
  const toss = requireToss ? localToss : (matchToss?.tossWinnerTeamId ? matchToss : localToss);
  const tossReady = requireToss ? isTossComplete(localToss) : isTossComplete(toss);

  const battingOrder = useMemo(() => {
    if (!tossReady) return null;
    return resolveBattingOrder(team1, team2, toss);
  }, [team1, team2, toss, tossReady]);

  const battingFirstTeamId = battingOrder?.battingFirstTeamId;

  const [scoringMode, setScoringMode] = useState(() => draftScorer?.scoringMode || initialScoringMode);
  const [scoringModeConfirmed, setScoringModeConfirmed] = useState(
    () => draftScorer?.scoringModeConfirmed ?? (lockScoringMode || !requireScoringModePick),
  );
  const [innings1, setInnings1] = useState(() => (
    draftScorer?.innings1 || emptyInnings(rules.oversLimit)
  ));
  const [innings2, setInnings2] = useState(() => (
    draftScorer?.innings2 || emptyInnings(rules.oversLimit)
  ));

  const createInningsBallState = (battingTeam, bowlingTeam) => createBallByBallInningsState({
    squad: squadToBatters(battingTeam),
    battingTeamId: battingTeam?.id,
    bowlingTeamId: bowlingTeam?.id,
    rules,
  });

  const [innings1BallState, setInnings1BallState] = useState(() => (
    canRestoreDraftBallState ? draftScorer?.innings1BallState ?? null : null
  ));
  const [innings2BallState, setInnings2BallState] = useState(() => (
    canRestoreDraftBallState ? draftScorer?.innings2BallState ?? null : null
  ));
  const restoredBallStateRef = React.useRef(
    canRestoreDraftBallState && Boolean(draftScorer?.innings1BallState),
  );

  React.useEffect(() => {
    if (!battingOrder) return;
    if (restoredBallStateRef.current) {
      const storedLimit = innings1BallState?.oversLimit ?? innings2BallState?.oversLimit;
      if (Number(storedLimit) === Number(rules.oversLimit)) return;
      restoredBallStateRef.current = false;
    }
    setInnings1BallState(createInningsBallState(
      battingOrder.firstBattingTeam,
      battingOrder.firstBowlingTeam,
    ));
    setInnings2BallState(createInningsBallState(
      battingOrder.secondBattingTeam,
      battingOrder.secondBowlingTeam,
    ));
    setActiveBallInnings(1);
  }, [
    battingOrder?.firstBattingTeam?.id,
    battingOrder?.secondBattingTeam?.id,
    rules.oversLimit,
  ]);

  React.useEffect(() => {
    if (lockScoringMode) {
      setScoringMode(initialScoringMode);
      setScoringModeConfirmed(true);
    }
  }, [initialScoringMode, lockScoringMode]);

  const [activeBallInnings, setActiveBallInnings] = useState(() => draftScorer?.activeBallInnings || 1);
  const [superOverMode, setSuperOverMode] = useState(() => draftScorer?.superOverMode || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingRematch, setIsStartingRematch] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [submitFeedbackState, setSubmitFeedbackState] = useState('idle');
  const [validationMessage, setValidationMessage] = useState('');

  React.useEffect(() => {
    if (typeof onScorerSnapshotChange !== 'function') return;
    onScorerSnapshotChange({
      scoringMode,
      scoringModeConfirmed,
      innings1,
      innings2,
      innings1BallState,
      innings2BallState,
      activeBallInnings,
      superOverMode,
    });
  }, [
    scoringMode,
    scoringModeConfirmed,
    innings1,
    innings2,
    innings1BallState,
    innings2BallState,
    activeBallInnings,
    superOverMode,
    onScorerSnapshotChange,
  ]);

  const displayCurrentMatchNumber = completedMatchesCount + 1;
  const displayTotalMatches = totalMatchesCount || completedMatchesCount + 1;
  const activeOversLimit = superOverMode ? 1 : rules.oversLimit;

  const resetInputs = () => {
    setInnings1(emptyInnings(rules.oversLimit));
    setInnings2(emptyInnings(rules.oversLimit));
    if (battingOrder) {
      setInnings1BallState(createInningsBallState(
        battingOrder.firstBattingTeam,
        battingOrder.firstBowlingTeam,
      ));
      setInnings2BallState(createInningsBallState(
        battingOrder.secondBattingTeam,
        battingOrder.secondBowlingTeam,
      ));
    }
    setActiveBallInnings(1);
    setSuperOverMode(false);
    setValidationMessage('');
    restoredBallStateRef.current = false;
  };

  const updateInnings = (teamKey, field, value) => {
    const setter = teamKey === 1 ? setInnings1 : setInnings2;
    setter((prev) => ({ ...prev, [field]: value.replace(/[^\d.]/g, '') }));
    setValidationMessage('');
  };

  const resolveInningsInputs = () => {
    if (scoringMode === 'ballByBall') {
      return {
        firstInnings: mapInningsState(innings1BallState),
        secondInnings: mapInningsState(innings2BallState),
      };
    }
    const team1BatsFirst = String(battingFirstTeamId) === String(team1?.id);
    return {
      firstInnings: team1BatsFirst
        ? (superOverMode ? { ...innings1, overs: '1' } : innings1)
        : (superOverMode ? { ...innings2, overs: '1' } : innings2),
      secondInnings: team1BatsFirst
        ? (superOverMode ? { ...innings2, overs: '1' } : innings2)
        : (superOverMode ? { ...innings1, overs: '1' } : innings1),
    };
  };

  const canSubmitBallByBall = scoringMode !== 'ballByBall'
    || (innings1BallState && innings2BallState
      && isInningsComplete(innings1BallState)
      && isInningsComplete(innings2BallState));

  const ballByBallMatchComplete = scoringMode === 'ballByBall' && canSubmitBallByBall;

  const persistMatchResult = async ({ keepSessionOpen = false } = {}) => {
    const { firstInnings, secondInnings } = resolveInningsInputs();
    const playedOversLimit = scoringMode === 'ballByBall'
      ? Math.max(
        Number(innings1BallState?.oversLimit) || 0,
        Number(innings2BallState?.oversLimit) || 0,
        rules.oversLimit,
      )
      : rules.oversLimit;
    const effectiveRuleConfig = { ...ruleConfig, oversLimit: playedOversLimit };
    const statistics = buildBoxCricketMatchStatistics({
      team1,
      team2,
      innings1: firstInnings,
      innings2: secondInnings,
      ruleConfig: effectiveRuleConfig,
      superOver: superOverMode,
      battingFirstTeamId,
      toss: isTossComplete(toss) ? toss : null,
    });

    if (scoringMode === 'ballByBall') {
      statistics.scoringMode = 'ballByBall';
      statistics.innings = statistics.innings.map((entry, index) => ({
        ...entry,
        ballLog: index === 0 ? firstInnings.ballLog : secondInnings.ballLog,
      }));
    } else {
      statistics.scoringMode = 'summary';
    }

    const team1BatsFirst = String(battingFirstTeamId) === String(team1?.id);
    const score1 = team1BatsFirst ? statistics.innings[0].runs : statistics.innings[1].runs;
    const score2 = team1BatsFirst ? statistics.innings[1].runs : statistics.innings[0].runs;

    const validation = validateBoxCricketMatchSubmission(
      score1,
      score2,
      effectiveRuleConfig,
      { statistics },
    );

    if (!validation.valid) {
      setValidationMessage(validation.message || 'Invalid score');
      hapticError();
      return false;
    }

    setValidationMessage('');
    hapticSubmit();

    try {
      const result = await Promise.resolve(
        onSaveScore(matchId, score1, score2, { statistics }, { keepSessionOpen }),
      );
      if (result === false) {
        hapticError();
        return false;
      }
      hapticSuccess();
      resetInputs();
      return result;
    } catch {
      hapticError();
      return false;
    }
  };

  const handleSubmit = async () => {
    if (scoringMode === 'summary'
      && !superOverMode
      && rules.superOverEnabled
      && isBoxCricketInningsTied(innings1, innings2, ruleConfig)) {
      setSuperOverMode(true);
      setInnings1(emptyInnings(1));
      setInnings2(emptyInnings(1));
      setValidationMessage('Innings tied — enter super over scores (1 over each).');
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedbackState('loading');
    try {
      const result = await persistMatchResult();
      if (result === false) {
        setSubmitFeedbackState('idle');
        return;
      }
      if (result === 'continue') {
        setSubmitFeedbackState('idle');
        return;
      }
      setSubmitFeedbackState('success');
      setTimeout(() => setSubmitFeedbackState('idle'), 360);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewMatch = async () => {
    if (!ballByBallMatchComplete || typeof onRematch !== 'function') return;
    setIsStartingRematch(true);
    setValidationMessage('');
    try {
      const result = await persistMatchResult({ keepSessionOpen: true });
      if (result === false || result === 'continue') {
        setValidationMessage('Failed to save match. Check scores and try again.');
        hapticError();
        return;
      }
      onRematch(result);
    } finally {
      setIsStartingRematch(false);
    }
  };

  const handleFinishMatch = async () => {
    if (!ballByBallMatchComplete) return;
    setIsFinishing(true);
    setValidationMessage('');
    try {
      const result = await persistMatchResult({ keepSessionOpen: false });
      if (result === false || result === 'continue') {
        setValidationMessage('Failed to save match. Check scores and try again.');
        hapticError();
      }
    } finally {
      setIsFinishing(false);
    }
  };

  const summaryReady = innings1.runs && innings2.runs;
  const submitDisabled = isSubmitting
    || isStartingRematch
    || isFinishing
    || submitFeedbackState === 'success'
    || !tossReady
    || (scoringMode === 'summary' ? !summaryReady : !canSubmitBallByBall);

  if (requireToss && !tossReady) {
    return (
      <BoxCricketTossPanel
        team1={team1}
        team2={team2}
        tossWinnerTeamId={localToss.tossWinnerTeamId}
        electedTo={localToss.electedTo}
        onChangeTossWinner={(id) => setLocalToss((prev) => ({ ...prev, tossWinnerTeamId: id }))}
        onChangeElectedTo={(value) => setLocalToss((prev) => ({ ...prev, electedTo: value }))}
        onContinue={() => {}}
        continueDisabled
      />
    );
  }

  if (requireScoringModePick && !scoringModeConfirmed) {
    return (
      <div className="variant-a-card variant-a-live-card box-cricket-scorer">
        <div className="variant-a-live-head">
          <div>
            <p className="variant-a-section-label">{title}</p>
            <h2 className="variant-a-live-title">
              {team1?.name} vs {team2?.name}
            </h2>
          </div>
        </div>
        <BoxCricketScoringModePanel
          value={scoringMode}
          onChange={setScoringMode}
          onContinue={() => setScoringModeConfirmed(true)}
        />
      </div>
    );
  }

  return (
    <div className="variant-a-card variant-a-live-card box-cricket-scorer">
      <div className="variant-a-live-head">
        <div>
          <p className="variant-a-section-label">{title}</p>
          <h2 className="variant-a-live-title">
            {team1?.name} vs {team2?.name}
          </h2>
          {battingOrder && (
            <p className="box-cricket-toss-summary">
              {battingOrder.firstBattingTeam?.name} bat first
              {toss?.tossWinnerTeamId ? ` · toss: ${String(toss.tossWinnerTeamId) === String(team1?.id) ? team1?.name : team2?.name} chose ${toss.electedTo}` : ''}
            </p>
          )}
        </div>
        {totalMatchesCount > 0 && (
          <span className="variant-a-context-chip">
            Match {displayCurrentMatchNumber} of {displayTotalMatches}
          </span>
        )}
      </div>

      {!lockScoringMode && (
        <div className="box-cricket-scoring-mode-toggle">
          <button
            type="button"
            className={`box-cricket-mode-btn ${scoringMode === 'summary' ? 'is-active' : ''}`}
            onClick={() => setScoringMode('summary')}
            disabled={isSubmitting}
          >
            Runs & wickets
          </button>
          <button
            type="button"
            className={`box-cricket-mode-btn ${scoringMode === 'ballByBall' ? 'is-active' : ''}`}
            onClick={() => setScoringMode('ballByBall')}
            disabled={isSubmitting}
          >
            Ball by ball
          </button>
        </div>
      )}

      <p className="variant-a-score-presets-label">
        {superOverMode
          ? 'Super over · 1 over · max 2 wickets'
          : getBoxCricketRulesSummary(ruleConfig)}
      </p>

      {superOverMode && scoringMode === 'summary' && (
        <p className="box-cricket-super-over-note">Super over required — tied innings</p>
      )}

      {scoringMode === 'summary' ? (
        <BoxCricketSummaryScorePanel
          team1={team1}
          team2={team2}
          innings1={innings1}
          innings2={innings2}
          superOverMode={superOverMode}
          activeOversLimit={activeOversLimit}
          isSubmitting={isSubmitting}
          onUpdateInnings={updateInnings}
          battingFirstTeamId={battingFirstTeamId}
        />
      ) : (
        innings1BallState && innings2BallState && battingOrder && (
          <BoxCricketBallByBallPanel
            firstInningsBattingTeam={battingOrder.firstBattingTeam}
            firstInningsBowlingTeam={battingOrder.firstBowlingTeam}
            secondInningsBattingTeam={battingOrder.secondBattingTeam}
            secondInningsBowlingTeam={battingOrder.secondBowlingTeam}
            rules={rules}
            innings1State={innings1BallState}
            setInnings1State={setInnings1BallState}
            innings2State={innings2BallState}
            setInnings2State={setInnings2BallState}
            activeInnings={activeBallInnings}
            setActiveInnings={setActiveBallInnings}
            onInnings1Complete={() => setActiveBallInnings(2)}
            onStartNewMatch={handleStartNewMatch}
            startingNewMatch={isStartingRematch}
            rematchLabel={rematchLabel}
            onFinish={handleFinishMatch}
            finishing={isFinishing}
            finishLabel="Finish"
            actionError={validationMessage}
            disabled={isSubmitting || isStartingRematch || isFinishing}
          />
        )
      )}

      {validationMessage && (
        <p className="box-cricket-validation-msg">{validationMessage}</p>
      )}

      <div className="variant-a-submit-row" data-no-gesture="true">
        {!ballByBallMatchComplete && (
        <button
          onClick={() => void handleSubmit()}
          disabled={submitDisabled}
          className={`variant-a-submit-btn action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
        >
          {(isSubmitting || submitFeedbackState === 'loading') ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : submitFeedbackState === 'success' ? (
            <>
              <CheckCircle2 size={16} />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Trophy size={16} />
              <span>{submitLabel || (superOverMode ? 'Submit Super Over' : 'Submit Result')}</span>
            </>
          )}
        </button>
        )}
        {syncState?.status && (
          <div className={`variant-a-inline-sync live-inline-sync live-inline-sync-${syncState.status}`}>
            <span>{syncState.label || syncState.status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoxCricketScorer;
