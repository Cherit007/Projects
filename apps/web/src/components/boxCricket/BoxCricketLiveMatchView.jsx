import React, { useMemo, useState } from 'react';
import { Trophy, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  buildBoxCricketMatchStatistics,
  getBoxCricketRulesSummary,
  isBoxCricketInningsTied,
  resolveBoxCricketRules,
  validateBoxCricketMatchSubmission,
} from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import { hapticError, hapticSubmit, hapticSuccess } from '../../utils/haptics';

const emptyInnings = (oversLimit) => ({ runs: '', wickets: '0', overs: String(oversLimit) });

const BoxCricketLiveMatchView = ({
  currentMatch,
  onSaveScore,
  sportId = 'boxCricket',
  ruleConfig = {},
  syncState = null,
  completedMatchesCount = 0,
  totalMatchesCount = 0,
}) => {
  const rules = useMemo(() => resolveBoxCricketRules(ruleConfig), [ruleConfig]);
  const [innings1, setInnings1] = useState(emptyInnings(rules.oversLimit));
  const [innings2, setInnings2] = useState(emptyInnings(rules.oversLimit));
  const [superOverMode, setSuperOverMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedbackState, setSubmitFeedbackState] = useState('idle');
  const [validationMessage, setValidationMessage] = useState('');

  const displayCurrentMatchNumber = completedMatchesCount + 1;
  const displayTotalMatches = totalMatchesCount || completedMatchesCount + 1;
  const activeOversLimit = superOverMode ? 1 : rules.oversLimit;

  const resetInputs = () => {
    setInnings1(emptyInnings(rules.oversLimit));
    setInnings2(emptyInnings(rules.oversLimit));
    setSuperOverMode(false);
    setValidationMessage('');
  };

  const updateInnings = (teamKey, field, value) => {
    const setter = teamKey === 1 ? setInnings1 : setInnings2;
    setter((prev) => ({ ...prev, [field]: value.replace(/[^\d.]/g, '') }));
    setValidationMessage('');
  };

  const handleSubmit = async () => {
    const statistics = buildBoxCricketMatchStatistics({
      team1: currentMatch.team1,
      team2: currentMatch.team2,
      innings1: superOverMode
        ? { ...innings1, overs: '1' }
        : innings1,
      innings2: superOverMode
        ? { ...innings2, overs: '1' }
        : innings2,
      ruleConfig,
      superOver: superOverMode,
    });

    const validation = validateBoxCricketMatchSubmission(
      statistics.innings[0].runs,
      statistics.innings[1].runs,
      ruleConfig,
      { statistics },
    );

    if (!validation.valid) {
      if (!superOverMode
        && rules.superOverEnabled
        && isBoxCricketInningsTied(innings1, innings2, ruleConfig)) {
        setSuperOverMode(true);
        setInnings1(emptyInnings(1));
        setInnings2(emptyInnings(1));
        setValidationMessage('Innings tied — enter super over scores (1 over each).');
        return;
      }
      setValidationMessage(validation.message || 'Invalid score');
      hapticError();
      return;
    }

    const score1 = statistics.innings[0].runs;
    const score2 = statistics.innings[1].runs;

    setIsSubmitting(true);
    setSubmitFeedbackState('loading');
    hapticSubmit();

    try {
      const result = await Promise.resolve(
        onSaveScore(currentMatch.id, score1, score2, { statistics }),
      );
      if (result === false) {
        setSubmitFeedbackState('idle');
        hapticError();
        return;
      }
      hapticSuccess();
      setSubmitFeedbackState('success');
      resetInputs();
      setTimeout(() => setSubmitFeedbackState('idle'), 360);
    } catch {
      setSubmitFeedbackState('idle');
      hapticError();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInningsBlock = (team, teamKey, innings, accentClass) => (
    <div className={`variant-a-score-side ${accentClass}`}>
      <p className="variant-a-score-team">{team?.name}</p>
      <div className="box-cricket-innings-grid">
        <label className="box-cricket-innings-field">
          <span>Runs</span>
          <input
            type="text"
            inputMode="numeric"
            value={innings.runs}
            onChange={(event) => updateInnings(teamKey, 'runs', event.target.value)}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
            aria-label={`${team?.name || 'Team'} runs`}
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>Wkts</span>
          <input
            type="text"
            inputMode="numeric"
            value={innings.wickets}
            onChange={(event) => updateInnings(teamKey, 'wickets', event.target.value)}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>Overs</span>
          <input
            type="text"
            inputMode="decimal"
            value={superOverMode ? '1' : innings.overs}
            onChange={(event) => updateInnings(teamKey, 'overs', event.target.value)}
            placeholder={String(activeOversLimit)}
            className="variant-a-score-input"
            disabled={isSubmitting || superOverMode}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="variant-a-card variant-a-live-card">
      <div className="variant-a-live-head">
        <div>
          <p className="variant-a-section-label">Live match · {sportId === 'boxCricket' ? 'Box Cricket' : 'Cricket'}</p>
          <h2 className="variant-a-live-title">
            {currentMatch.team1.name} vs {currentMatch.team2.name}
          </h2>
        </div>
        <span className="variant-a-context-chip">
          Match {displayCurrentMatchNumber} of {displayTotalMatches}
        </span>
      </div>

      <p className="variant-a-score-presets-label">
        {superOverMode
          ? 'Super over · 1 over · max 2 wickets'
          : getBoxCricketRulesSummary(ruleConfig)}
      </p>

      {superOverMode && (
        <p className="text-sm font-semibold text-amber-700 mb-2">Super over required — tied innings</p>
      )}

      <div className="variant-a-score-grid box-cricket-score-grid">
        {renderInningsBlock(currentMatch.team1, 1, innings1, 'quick-score-team-pad-one')}
        <div className="variant-a-vs">VS</div>
        {renderInningsBlock(currentMatch.team2, 2, innings2, 'quick-score-team-pad-two')}
      </div>

      {validationMessage && (
        <p className="text-sm text-red-600 mt-2">{validationMessage}</p>
      )}

      <div className="variant-a-submit-row" data-no-gesture="true">
        <button
          onClick={() => void handleSubmit()}
          disabled={!innings1.runs || !innings2.runs || isSubmitting || submitFeedbackState === 'success'}
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
              <span>{superOverMode ? 'Submit Super Over' : 'Submit Result'}</span>
            </>
          )}
        </button>
        {syncState?.status && (
          <div className={`variant-a-inline-sync live-inline-sync live-inline-sync-${syncState.status}`}>
            <span>{syncState.label || syncState.status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoxCricketLiveMatchView;
