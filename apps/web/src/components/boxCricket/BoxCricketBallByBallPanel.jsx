import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import {
  confirmInningsBatter,
  confirmInningsLineup,
  formatOverLabel,
  getAvailableBatters,
  getAvailableBowlers,
  getBenchBatters,
  getCurrentOverBalls,
  getCurrentOverNumber,
  getInningsEndReason,
  getLegalBallsInCurrentOver,
  inningsStateToSummary,
  isInningsComplete,
  needsBatterSelection,
  needsBowlerSelection,
  recordBallDelivery,
  setInningsBowler,
  swapInningsBatter,
  swapInningsBowler,
  canSwapBowlerMidOver,
  undoLastDelivery,
} from '@fixture-maker/domain/sports/boxCricket/ballByBallScoring';
import { buildInningsScorecard, buildMatchHighlights } from '@fixture-maker/domain/sports/boxCricket/scorecard';
import { normalizeSquad } from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import BoxCricketInningsScorecard from './BoxCricketInningsScorecard';
import BoxCricketMatchResult from './BoxCricketMatchResult';
import DeliveryFlash from './DeliveryFlash';

const squadToPlayers = (team) => normalizeSquad(team?.squad).map((player) => ({
  id: player.id,
  name: player.name,
}));

const playerName = (squad, id) => squad.find((player) => String(player.id) === String(id))?.name || '—';

const strikerRunsBeforeBall = (state, strikerId) => (
  state.balls
    .filter((ball) => String(ball.strikerId) === String(strikerId) && ball.kind === 'runs')
    .reduce((sum, ball) => sum + (Number(ball.runs) || 0), 0)
);

const resolveDeliveryFlash = (state, delivery) => {
  if (delivery.kind === 'runs' && delivery.runs === 4) return 'four';
  if (delivery.kind === 'runs' && delivery.runs === 6) return 'six';
  if (delivery.kind === 'wide') return 'wide';
  if (delivery.kind === 'noBall') return 'noBall';
  if (delivery.kind === 'wicket') {
    return strikerRunsBeforeBall(state, state.strikerId) === 0 ? 'duck' : 'wicket';
  }
  return null;
};

const ballChipLabel = (ball) => {
  if (ball.kind === 'wicket') return 'W';
  if (ball.kind === 'wide') return `Wd${ball.runs > 1 ? `+${ball.runs}` : ''}`;
  if (ball.kind === 'noBall') return `Nb${ball.runs > 1 ? `+${ball.runs}` : ''}`;
  return String(ball.runs);
};

const OverMap = ({ state }) => {
  const trackRef = useRef(null);
  const overBalls = getCurrentOverBalls(state);
  const overNumber = getCurrentOverNumber(state.legalBalls);
  const legalInOver = overBalls.filter((ball) => ball.kind !== 'wide' && ball.kind !== 'noBall').length;

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollLeft = trackRef.current.scrollWidth;
    }
  }, [overBalls.length, overNumber]);

  return (
    <div className="box-cricket-over-map">
      <div className="box-cricket-over-map-head">
        <span className="box-cricket-over-map-label">Over {overNumber + 1}</span>
        <span className="box-cricket-over-map-count">{legalInOver}/6 legal</span>
      </div>
      <div className="box-cricket-over-map-track" ref={trackRef}>
        {overBalls.length === 0 ? (
          <div className="box-cricket-over-slot is-empty">—</div>
        ) : overBalls.map((ball, index) => (
          <div
            key={`${overNumber}-${index}-${ball.kind}-${ball.runs}`}
            className={`box-cricket-over-slot is-${ball.kind} ${index === overBalls.length - 1 ? 'is-latest' : ''}`}
          >
            {ballChipLabel(ball)}
          </div>
        ))}
      </div>
    </div>
  );
};

const LineupSetup = ({
  mode = 'lineup',
  title,
  copy,
  batters,
  bowlers,
  strikerId,
  nonStrikerId,
  bowlerId,
  onStrikerChange,
  onNonStrikerChange,
  onBowlerChange,
  onConfirm,
  confirmLabel = 'Start innings',
  disabled,
  errorMessage = '',
}) => {
  const canConfirm = mode === 'batter'
    ? Boolean(strikerId)
    : mode === 'bowler'
      ? Boolean(bowlerId)
      : Boolean(strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId);

  return (
    <div className="box-cricket-lineup-setup box-cricket-panel-enter">
      <h4 className="box-cricket-lineup-title">{title}</h4>
      <p className="box-cricket-lineup-copy">{copy}</p>
      <div className={`box-cricket-striker-row ${mode === 'lineup' ? '' : 'is-single'}`}>
        {(mode === 'lineup' || mode === 'batter') && (
          <label className="box-cricket-striker-field">
            <span>{mode === 'batter' ? 'New striker' : 'Striker'}</span>
            <select value={strikerId} onChange={(event) => onStrikerChange(event.target.value)} disabled={disabled} className="box-cricket-striker-select">
              <option value="">Select</option>
              {batters.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
        )}
        {mode === 'lineup' && (
          <label className="box-cricket-striker-field">
            <span>Non-striker</span>
            <select value={nonStrikerId} onChange={(event) => onNonStrikerChange(event.target.value)} disabled={disabled} className="box-cricket-striker-select">
              <option value="">Select</option>
              {batters.filter((player) => String(player.id) !== String(strikerId)).map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
        )}
        {(mode === 'lineup' || mode === 'bowler') && bowlers.length > 0 && (
          <label className="box-cricket-striker-field">
            <span>Bowler</span>
            <select value={bowlerId} onChange={(event) => onBowlerChange(event.target.value)} disabled={disabled} className="box-cricket-striker-select">
              <option value="">Select</option>
              {bowlers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {errorMessage && <p className="box-cricket-inline-error">{errorMessage}</p>}
      <button type="button" className="box-cricket-lineup-confirm" disabled={disabled || !canConfirm} onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  );
};

const BallControls = ({ disabled, onDeliver }) => (
  <div className="box-cricket-ball-pad box-cricket-panel-enter">
    {[0, 1, 2, 3, 4, 6].map((runs) => (
      <button key={runs} type="button" className="box-cricket-ball-btn" disabled={disabled} onClick={() => onDeliver({ kind: 'runs', runs })}>
        {runs}
      </button>
    ))}
    <button type="button" className="box-cricket-ball-btn box-cricket-ball-btn-wicket" disabled={disabled} onClick={() => onDeliver({ kind: 'wicket', runs: 0 })}>
      W
    </button>
    <button type="button" className="box-cricket-ball-btn box-cricket-ball-btn-extra" disabled={disabled} onClick={() => onDeliver({ kind: 'wide', runs: 1 })}>
      WD
    </button>
    <button type="button" className="box-cricket-ball-btn box-cricket-ball-btn-extra" disabled={disabled} onClick={() => onDeliver({ kind: 'noBall', runs: 1 })}>
      NB
    </button>
  </div>
);

const InningsScorer = ({
  label,
  battingTeam,
  bowlingTeam,
  state,
  setState,
  chaseTarget = null,
  firstInningsCard = null,
  disabled,
  onInningsComplete = null,
}) => {
  const batters = useMemo(() => squadToPlayers(battingTeam), [battingTeam]);
  const bowlers = useMemo(() => squadToPlayers(bowlingTeam), [bowlingTeam]);
  const available = getAvailableBatters(batters, state.dismissedIds);
  const overLabel = formatOverLabel(state.legalBalls);
  const ballsInOver = getLegalBallsInCurrentOver(state.legalBalls);

  const [draftStriker, setDraftStriker] = useState('');
  const [draftNonStriker, setDraftNonStriker] = useState('');
  const [draftBowler, setDraftBowler] = useState('');
  const [nextBowlerId, setNextBowlerId] = useState('');
  const [actionError, setActionError] = useState('');
  const [viewMode, setViewMode] = useState('live');
  const [deliveryFlash, setDeliveryFlash] = useState(null);
  const flashTimerRef = useRef(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapRole, setSwapRole] = useState('striker');
  const [swapIncomingId, setSwapIncomingId] = useState('');
  const [swapBowlerOpen, setSwapBowlerOpen] = useState(false);
  const [swapBowlerId, setSwapBowlerId] = useState('');
  const inningsCompleteNotifiedRef = useRef(false);

  useEffect(() => {
    if (chaseTarget == null || state.chaseTarget === chaseTarget) return;
    setState((prev) => ({ ...prev, chaseTarget }));
  }, [chaseTarget, setState, state.chaseTarget]);

  const scorecard = useMemo(
    () => buildInningsScorecard(state, batters, bowlers),
    [state, batters, bowlers],
  );

  const showLineup = !state.lineupConfirmed;
  const showBatterPicker = needsBatterSelection(state);
  const showBowlerPicker = needsBowlerSelection(state);
  const isNewOver = showBowlerPicker && Boolean(state.lastBowlerId);
  const canScore = state.lineupConfirmed && !showBatterPicker && !showBowlerPicker && !isInningsComplete(state);
  const showLiveScoring = viewMode === 'live';

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  useEffect(() => {
    if (isInningsComplete(state) && viewMode === 'live') {
      setViewMode('scorecard');
    }
  }, [state.chaseComplete, state.allOut, state.legalBalls, state.wickets, state.oversLimit, viewMode]);

  const triggerDeliveryFlash = (type) => {
    if (!type) return;
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setDeliveryFlash(type);
    const duration = type === 'duck' ? 1400 : 1000;
    flashTimerRef.current = window.setTimeout(() => setDeliveryFlash(null), duration);
  };

  useEffect(() => {
    if (showLineup || showBatterPicker || showBowlerPicker) {
      setViewMode('live');
    }
  }, [showLineup, showBatterPicker, showBowlerPicker]);

  const eligibleBowlers = getAvailableBowlers(bowlers, { lastBowlerId: state.lastBowlerId });
  const eligibleNewBatters = available.filter((player) => String(player.id) !== String(state.nonStrikerId));
  const benchBatters = getBenchBatters(batters, state);
  const canSwapBowler = canSwapBowlerMidOver(state);
  const swapBowlerOptions = bowlers.filter((player) => String(player.id) !== String(state.bowlerId));
  const inningsEndReason = getInningsEndReason(state);

  useEffect(() => {
    if (!onInningsComplete || !isInningsComplete(state) || inningsCompleteNotifiedRef.current) return;
    inningsCompleteNotifiedRef.current = true;
    onInningsComplete();
  }, [state, onInningsComplete]);

  useEffect(() => {
    if (!isInningsComplete(state)) {
      inningsCompleteNotifiedRef.current = false;
    }
  }, [state.balls.length, state.wickets, state.allOut, state.legalBalls, state.chaseComplete]);

  const canUndo = state.balls.length > 0 && !disabled;
  const viewSwitchClass = firstInningsCard
    ? 'box-cricket-view-switch has-three'
    : 'box-cricket-view-switch';

  const handleConfirmLineup = () => {
    setActionError('');
    setState(confirmInningsLineup(state, {
      strikerId: draftStriker,
      nonStrikerId: draftNonStriker,
      bowlerId: draftBowler,
    }));
  };

  const handleConfirmBowler = () => {
    setActionError('');
    const result = setInningsBowler(state, nextBowlerId);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    setNextBowlerId('');
  };

  const handleConfirmNewBatter = () => {
    setActionError('');
    const result = confirmInningsBatter(state, draftStriker);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    setDraftStriker('');
  };

  const handleDeliver = (delivery) => {
    if (!canScore) return;
    setActionError('');
    const payload = delivery.kind === 'wicket'
      ? { ...delivery, dismissedPlayerId: state.strikerId }
      : delivery;
    const result = recordBallDelivery(state, payload, batters);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    triggerDeliveryFlash(resolveDeliveryFlash(state, delivery));
  };

  const handleSwapBatter = () => {
    setActionError('');
    const result = swapInningsBatter(state, { creaseRole: swapRole, incomingId: swapIncomingId }, batters);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    setSwapIncomingId('');
    setSwapOpen(false);
  };

  const handleSwapBowler = () => {
    setActionError('');
    const result = swapInningsBowler(state, swapBowlerId, bowlers);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    setSwapBowlerId('');
    setSwapBowlerOpen(false);
  };

  const handleUndo = () => {
    setActionError('');
    const result = undoLastDelivery(state);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setState(result.state);
    setDraftStriker(result.state.strikerId || '');
    setNextBowlerId('');
  };

  const runsNeeded = chaseTarget != null ? Math.max(0, chaseTarget - state.runs) : null;

  return (
    <div className="box-cricket-ball-innings">
      <DeliveryFlash type={deliveryFlash} />
      <div className="box-cricket-ball-innings-head">
        <div>
          <h3>{label}: {battingTeam?.name || 'Team'}</h3>
          <p className="box-cricket-innings-scoreline">
            {state.runs}/{state.wickets} ({overLabel})
            {chaseTarget != null && (
              <span className="box-cricket-chase-chip">Need {runsNeeded} off {Math.max((state.oversLimit * 6) - state.legalBalls, 0)} balls</span>
            )}
          </p>
        </div>
      </div>

      <div className={viewSwitchClass}>
        <button
          type="button"
          className={`box-cricket-view-switch-btn ${viewMode === 'live' ? 'is-active' : ''}`}
          onClick={() => setViewMode('live')}
        >
          Live
        </button>
        <button
          type="button"
          className={`box-cricket-view-switch-btn ${viewMode === 'scorecard' ? 'is-active' : ''}`}
          onClick={() => setViewMode('scorecard')}
        >
          Scorecard
        </button>
        {firstInningsCard && (
          <button
            type="button"
            className={`box-cricket-view-switch-btn ${viewMode === 'firstInnings' ? 'is-active' : ''}`}
            onClick={() => setViewMode('firstInnings')}
          >
            1st inn
          </button>
        )}
      </div>

      {canUndo && (
        <div className="box-cricket-innings-toolbar">
          <button type="button" className="box-cricket-toolbar-btn" disabled={!canUndo} onClick={handleUndo} title="Undo last ball">
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          {canScore && benchBatters.length > 0 && showLiveScoring && (
            <button type="button" className="box-cricket-toolbar-btn" onClick={() => setSwapOpen((value) => !value)}>
              Swap batter
            </button>
          )}
          {canScore && canSwapBowler && showLiveScoring && (
            <button type="button" className="box-cricket-toolbar-btn" onClick={() => setSwapBowlerOpen((value) => !value)}>
              Swap bowler
            </button>
          )}
        </div>
      )}

      {swapOpen && canScore && (
        <div className="box-cricket-lineup-setup box-cricket-panel-enter">
          <h4 className="box-cricket-lineup-title">Swap batter</h4>
          <p className="box-cricket-lineup-copy">Replace a batter at the crease with someone from the bench who is not out.</p>
          <div className="box-cricket-striker-row is-single">
            <label className="box-cricket-striker-field">
              <span>Replace</span>
              <select value={swapRole} onChange={(event) => setSwapRole(event.target.value)} className="box-cricket-striker-select">
                <option value="striker">Striker ({playerName(batters, state.strikerId)})</option>
                <option value="nonStriker">Non-striker ({playerName(batters, state.nonStrikerId)})</option>
              </select>
            </label>
            <label className="box-cricket-striker-field">
              <span>With</span>
              <select value={swapIncomingId} onChange={(event) => setSwapIncomingId(event.target.value)} className="box-cricket-striker-select">
                <option value="">Select</option>
                {benchBatters.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="box-cricket-lineup-confirm" disabled={!swapIncomingId || disabled} onClick={handleSwapBatter}>
            Confirm swap
          </button>
        </div>
      )}

      {swapBowlerOpen && canScore && canSwapBowler && (
        <div className="box-cricket-lineup-setup box-cricket-panel-enter">
          <h4 className="box-cricket-lineup-title">Swap bowler mid-over</h4>
          <p className="box-cricket-lineup-copy">
            Replace {playerName(bowlers, state.bowlerId)} for the remaining balls in this over.
          </p>
          <div className="box-cricket-striker-row is-single">
            <label className="box-cricket-striker-field">
              <span>New bowler</span>
              <select value={swapBowlerId} onChange={(event) => setSwapBowlerId(event.target.value)} className="box-cricket-striker-select">
                <option value="">Select</option>
                {swapBowlerOptions.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="box-cricket-lineup-confirm" disabled={!swapBowlerId || disabled} onClick={handleSwapBowler}>
            Confirm bowler swap
          </button>
        </div>
      )}

      {actionError && <p className="box-cricket-inline-error">{actionError}</p>}

      {viewMode === 'firstInnings' && firstInningsCard && (
        <BoxCricketInningsScorecard
          scorecard={firstInningsCard.scorecard}
          battingTeamName={firstInningsCard.teamName}
        />
      )}

      {viewMode === 'scorecard' && !showLineup && !showBatterPicker && !showBowlerPicker && (
        <BoxCricketInningsScorecard
          scorecard={scorecard}
          battingTeamName={battingTeam?.name}
        />
      )}

      {showLineup && (
        <LineupSetup
          mode="lineup"
          title="Opening lineup"
          copy="Pick opening pair and bowler before the first ball."
          batters={available}
          bowlers={bowlers}
          strikerId={draftStriker}
          nonStrikerId={draftNonStriker}
          bowlerId={draftBowler}
          onStrikerChange={setDraftStriker}
          onNonStrikerChange={setDraftNonStriker}
          onBowlerChange={setDraftBowler}
          onConfirm={handleConfirmLineup}
          disabled={disabled}
        />
      )}

      {showBatterPicker && (
        <LineupSetup
          mode="batter"
          title="Who bats next?"
          copy={`Select the new striker. Non-striker stays at the crease (${playerName(batters, state.nonStrikerId)}).`}
          batters={eligibleNewBatters}
          bowlers={[]}
          strikerId={draftStriker}
          nonStrikerId={state.nonStrikerId}
          bowlerId=""
          onStrikerChange={setDraftStriker}
          onNonStrikerChange={() => {}}
          onBowlerChange={() => {}}
          onConfirm={handleConfirmNewBatter}
          confirmLabel="Send batter in"
          disabled={disabled}
          errorMessage={actionError}
        />
      )}

      {showBowlerPicker && !showBatterPicker && (
        <LineupSetup
          mode="bowler"
          title={isNewOver ? 'New over' : 'Select bowler'}
          copy={isNewOver
            ? `${playerName(bowlers, state.lastBowlerId)} finished the over — pick a different bowler.`
            : 'Choose the bowler for this over.'}
          batters={[]}
          bowlers={eligibleBowlers}
          strikerId=""
          nonStrikerId=""
          bowlerId={nextBowlerId}
          onStrikerChange={() => {}}
          onNonStrikerChange={() => {}}
          onBowlerChange={setNextBowlerId}
          onConfirm={handleConfirmBowler}
          confirmLabel={isNewOver ? 'Start over' : 'Confirm bowler'}
          disabled={disabled}
          errorMessage={actionError}
        />
      )}

      {canScore && showLiveScoring && (
        <div className="box-cricket-scoring-live">
          <OverMap state={state} />
          <div className="box-cricket-live-players">
            <div className="box-cricket-live-player is-striker">
              <span className="box-cricket-live-player-label">Striker</span>
              <strong>{playerName(batters, state.strikerId)}</strong>
            </div>
            <div className="box-cricket-live-player">
              <span className="box-cricket-live-player-label">Non-striker</span>
              <strong>{playerName(batters, state.nonStrikerId)}</strong>
            </div>
            <div className="box-cricket-live-player">
              <span className="box-cricket-live-player-label">Bowler</span>
              <strong>{playerName(bowlers, state.bowlerId)}</strong>
            </div>
            <div className="box-cricket-live-player">
              <span className="box-cricket-live-player-label">This over</span>
              <strong>{ballsInOver}/6</strong>
            </div>
          </div>

          <BallControls disabled={disabled} onDeliver={handleDeliver} />
        </div>
      )}

      {isInningsComplete(state) && (
        <div className="box-cricket-innings-complete box-cricket-panel-enter">
          <p>
            {inningsEndReason === 'chaseWon'
              ? 'Target reached — chase complete!'
              : inningsEndReason === 'allOut'
                ? 'All out — innings ended.'
                : inningsEndReason === 'overs'
                  ? 'Overs complete — innings ended.'
                  : 'Innings complete.'}
          </p>
          {label === '1st innings' && (
            <button type="button" className="box-cricket-lineup-confirm box-cricket-lineup-confirm-inline" onClick={onInningsComplete}>
              Start 2nd innings
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const BoxCricketBallByBallPanel = ({
  firstInningsBattingTeam,
  firstInningsBowlingTeam,
  secondInningsBattingTeam,
  secondInningsBowlingTeam,
  innings1State,
  setInnings1State,
  innings2State,
  setInnings2State,
  activeInnings,
  setActiveInnings,
  onInnings1Complete = null,
  onStartNewMatch = null,
  startingNewMatch = false,
  rematchLabel = 'Start new match',
  onFinish = null,
  finishing = false,
  finishLabel = 'Finish',
  actionError = '',
  disabled,
}) => {
  if (!innings1State || !innings2State) {
    return null;
  }

  const chaseTarget = isInningsComplete(innings1State) ? innings1State.runs + 1 : null;
  const matchComplete = isInningsComplete(innings1State) && isInningsComplete(innings2State);

  const firstInningsScorecard = useMemo(
    () => buildInningsScorecard(
      innings1State,
      squadToPlayers(firstInningsBattingTeam),
      squadToPlayers(firstInningsBowlingTeam),
    ),
    [innings1State, firstInningsBattingTeam, firstInningsBowlingTeam],
  );

  const matchHighlights = useMemo(() => {
    if (!matchComplete) return null;
    return buildMatchHighlights({
      innings1State,
      innings2State,
      firstBattingTeam: firstInningsBattingTeam,
      secondBattingTeam: secondInningsBattingTeam,
      firstBowlingTeam: firstInningsBowlingTeam,
      secondBowlingTeam: secondInningsBowlingTeam,
    });
  }, [
    matchComplete,
    innings1State,
    innings2State,
    firstInningsBattingTeam,
    secondInningsBattingTeam,
    firstInningsBowlingTeam,
    secondInningsBowlingTeam,
  ]);

  const firstInningsCard = activeInnings === 2 && isInningsComplete(innings1State)
    ? { scorecard: firstInningsScorecard, teamName: firstInningsBattingTeam?.name }
    : null;

  const handleMatchUndo = () => {
    const result = undoLastDelivery(innings2State);
    if (!result.error) {
      setInnings2State(result.state);
    }
  };

  return (
    <div className="box-cricket-ball-by-ball">
      {matchComplete && matchHighlights && (
        <BoxCricketMatchResult
          highlights={matchHighlights}
          canUndo={innings2State.balls.length > 0 && !disabled && !startingNewMatch && !finishing}
          onUndo={handleMatchUndo}
          onStartNewMatch={onStartNewMatch}
          startingNewMatch={startingNewMatch}
          rematchLabel={rematchLabel}
          onFinish={onFinish}
          finishing={finishing}
          finishLabel={finishLabel}
          actionError={actionError}
        />
      )}

      {!matchComplete && (
      <>
      <div className="box-cricket-innings-tabs">
        <button
          type="button"
          className={`box-cricket-innings-tab ${activeInnings === 1 ? 'is-active' : ''}`}
          onClick={() => setActiveInnings(1)}
        >
          {firstInningsBattingTeam?.name} · 1st inn
        </button>
        <button
          type="button"
          className={`box-cricket-innings-tab ${activeInnings === 2 ? 'is-active' : ''}`}
          onClick={() => setActiveInnings(2)}
          disabled={!isInningsComplete(innings1State)}
        >
          {secondInningsBattingTeam?.name} · 2nd inn
        </button>
      </div>

      {isInningsComplete(innings1State) && activeInnings === 1 && !matchComplete && (
        <p className="box-cricket-innings-handoff">1st innings done — tap 2nd innings or use the button below to continue chasing.</p>
      )}

      <div className="box-cricket-innings-stage">
        {activeInnings === 1 && (
          <InningsScorer
            label="1st innings"
            battingTeam={firstInningsBattingTeam}
            bowlingTeam={firstInningsBowlingTeam}
            state={innings1State}
            setState={setInnings1State}
            disabled={disabled || matchComplete}
            onInningsComplete={onInnings1Complete}
          />
        )}

        {activeInnings === 2 && (
          <InningsScorer
            label="2nd innings"
            battingTeam={secondInningsBattingTeam}
            bowlingTeam={secondInningsBowlingTeam}
            state={innings2State}
            setState={setInnings2State}
            chaseTarget={chaseTarget}
            firstInningsCard={firstInningsCard}
            disabled={disabled}
          />
        )}
      </div>
      </>
      )}

      {matchComplete && (
        <div className="box-cricket-match-result-scorecards">
          <BoxCricketInningsScorecard
            scorecard={firstInningsScorecard}
            battingTeamName={`${firstInningsBattingTeam?.name || 'Team'} · 1st inn`}
          />
          <BoxCricketInningsScorecard
            scorecard={buildInningsScorecard(
              innings2State,
              squadToPlayers(secondInningsBattingTeam),
              squadToPlayers(secondInningsBowlingTeam),
            )}
            battingTeamName={`${secondInningsBattingTeam?.name || 'Team'} · 2nd inn`}
          />
        </div>
      )}
    </div>
  );
};

export { inningsStateToSummary };
export default BoxCricketBallByBallPanel;
