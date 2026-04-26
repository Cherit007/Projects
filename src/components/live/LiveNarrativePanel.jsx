import React from 'react';

const LiveNarrativePanel = ({
  prediction = null,
  upsetAlert = null,
  currentMatch = null,
}) => {
  if (!currentMatch || !prediction) return null;

  const team1Name = currentMatch?.team1?.name || 'Team 1';
  const team2Name = currentMatch?.team2?.name || 'Team 2';
  const team1Probability = Number(prediction?.team1Probability || 0.5);
  const team2Probability = Number(prediction?.team2Probability || 0.5);
  const favoriteIsTeam1 = team1Probability >= team2Probability;
  const favoriteName = favoriteIsTeam1 ? team1Name : team2Name;
  const underdogName = favoriteIsTeam1 ? team2Name : team1Name;
  const underdogProbability = favoriteIsTeam1 ? team2Probability : team1Probability;
  const formDiff = Number(prediction?.factors?.formDiff || 0);
  const headToHeadSample = Number(prediction?.h2h?.sampleSize || 0);
  const formLabel = formDiff > 0 ? `+${formDiff.toFixed(0)} form` : `${formDiff.toFixed(0)} form`;

  return (
    <div className="variant-a-narrative-grid">
      <article className="variant-a-narrative-card">
        <p className="variant-a-narrative-label">Favourite</p>
        <p className="variant-a-narrative-value">{favoriteName}</p>
        <p className="variant-a-narrative-copy">
          {Math.max(team1Probability, team2Probability).toFixed(0)}% win chance
        </p>
      </article>

      <article className="variant-a-narrative-card">
        <p className="variant-a-narrative-label">Rivalry</p>
        <p className="variant-a-narrative-value">{headToHeadSample} meetings</p>
        <p className="variant-a-narrative-copy">
          {headToHeadSample > 0 ? `${team1Name} vs ${team2Name}` : 'First encounter'}
        </p>
      </article>

      <article className="variant-a-narrative-card variant-a-narrative-card-wide">
        <div>
          <p className="variant-a-narrative-label">Upset meter</p>
          <p className="variant-a-narrative-value">{underdogName}</p>
          <p className="variant-a-narrative-copy">{(underdogProbability * 100).toFixed(0)}% upset chance</p>
        </div>
        <span className="variant-a-upset-chip">{upsetAlert?.title || formLabel}</span>
      </article>

      {upsetAlert && (
        <article className="variant-a-alert-card">
          <p className="variant-a-alert-title">{upsetAlert.title}</p>
          <p className="variant-a-alert-copy">{upsetAlert.message}</p>
        </article>
      )}
    </div>
  );
};

export default LiveNarrativePanel;
