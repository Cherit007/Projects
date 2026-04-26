import React from 'react';

const BracketView = ({ bracket, onMatchClick }) => {
  const getRoundName = (roundIndex) => {
    const totalRounds = bracket.length;
    const firstRoundType = bracket[0]?.[0]?.round;

    if (firstRoundType === 'playin' && roundIndex === 0) return 'Play-in Match';

    const roundsFromFinal = totalRounds - roundIndex;
    if (roundsFromFinal === 1) return 'Grand final';
    if (roundsFromFinal === 2) return 'Semi-finals';
    if (roundsFromFinal === 3) return 'Quarter-finals';
    return `Round ${roundIndex + 1}`;
  };

  const renderPending = (match, key) => (
    <button
      type="button"
      key={key}
      onClick={() => onMatchClick(match)}
      className="variant-a-pending-box"
    >
      <p className="variant-a-pending-label">{match?.team1 && match?.team2 ? 'Awaiting result' : 'Waiting for teams'}</p>
      <p className="variant-a-pending-matchup">
        {match?.team1?.name || 'TBD'} vs {match?.team2?.name || 'TBD'}
      </p>
      <p className="variant-a-meta-copy">Match {match?.id || '-'}</p>
    </button>
  );

  const renderMatch = (match, key) => {
    if (!match) return renderPending(match, key);
    const isCompleted = match.completed;
    const winnerId = isCompleted && match.score1 !== null && match.score2 !== null
      ? (match.score1 > match.score2 ? match.team1?.id : match.team2?.id)
      : null;

    if (!isCompleted) {
      return renderPending(match, key);
    }

    return (
      <button
        type="button"
        key={key}
        onClick={() => onMatchClick(match)}
        className="variant-a-bracket-match"
      >
        <div className={`variant-a-bracket-row ${winnerId === match.team1?.id ? 'variant-a-bracket-row-winner' : ''}`}>
          <div className="variant-a-bracket-team">
            <span className="variant-a-team-dot">{match.team1?.emoji || '🏸'}</span>
            <span className="variant-a-bracket-name">{match.team1?.name || 'TBD'}</span>
          </div>
          <span className={`variant-a-bracket-score ${winnerId === match.team1?.id ? 'variant-a-bracket-score-winner' : ''}`}>
            {match.score1}
          </span>
        </div>
        <div className={`variant-a-bracket-row ${winnerId === match.team2?.id ? 'variant-a-bracket-row-winner' : ''}`}>
          <div className="variant-a-bracket-team">
            <span className="variant-a-team-dot">{match.team2?.emoji || '🏸'}</span>
            <span className="variant-a-bracket-name">{match.team2?.name || 'TBD'}</span>
          </div>
          <span className={`variant-a-bracket-score ${winnerId === match.team2?.id ? 'variant-a-bracket-score-winner' : ''}`}>
            {match.score2}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="variant-a-card">
      <p className="variant-a-section-label">Final bracket</p>
      <div className="variant-a-bracket-stack">
        {bracket.map((round, roundIndex) => (
          <div key={`round-${roundIndex}`} className="space-y-2">
            <p className="variant-a-bracket-label">{getRoundName(roundIndex)}</p>
            {(Array.isArray(round) ? round : []).map((match, matchIndex) => (
              renderMatch(match, `${roundIndex}-${matchIndex}`)
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BracketView;
