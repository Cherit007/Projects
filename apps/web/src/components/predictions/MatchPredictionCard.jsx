import React from 'react';

const pct = (value) => `${Math.round((value || 0) * 100)}%`;

const MatchPredictionCard = ({ match, prediction, title = 'Prediction', compact = false }) => {
  if (!match?.team1 || !match?.team2 || !prediction) return null;

  const team1Pct = prediction.team1Probability || 0.5;
  const team2Pct = prediction.team2Probability || 0.5;
  const sampleSize = Number(prediction?.h2h?.sampleSize || 0);

  return (
    <div className={`variant-a-card variant-a-prediction-card ${compact ? 'variant-a-prediction-card-compact' : ''}`}>
      <p className="variant-a-section-label">{title}</p>

      <div className="variant-a-prediction-row">
        <span className="variant-a-prediction-team truncate">{match.team1.name}</span>
        <div className="variant-a-prediction-bar">
          <span className="variant-a-prediction-fill variant-a-prediction-fill-blue" style={{ width: `${team1Pct * 100}%` }} />
        </div>
        <span className="variant-a-prediction-value">{pct(team1Pct)}</span>
      </div>

      <div className="variant-a-prediction-row">
        <span className="variant-a-prediction-team truncate">{match.team2.name}</span>
        <div className="variant-a-prediction-bar">
          <span className="variant-a-prediction-fill variant-a-prediction-fill-green" style={{ width: `${team2Pct * 100}%` }} />
        </div>
        <span className="variant-a-prediction-value">{pct(team2Pct)}</span>
      </div>

      <div className="variant-a-prediction-footnote">
        <p>H2H: {sampleSize > 0 ? `${prediction.h2h.team1Wins}-${prediction.h2h.team2Wins}` : 'No direct history'}</p>
      </div>
    </div>
  );
};

export default MatchPredictionCard;
