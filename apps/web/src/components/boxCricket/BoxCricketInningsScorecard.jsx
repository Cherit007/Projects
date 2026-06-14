import React from 'react';

const BoxCricketInningsScorecard = ({
  scorecard,
  battingTeamName = 'Batting',
}) => (
  <div className="box-cricket-scorecard">
    <div className="box-cricket-scorecard-head">
      <div>
        <p className="box-cricket-scorecard-eyebrow">Scorecard</p>
        <h4 className="box-cricket-scorecard-title">{battingTeamName} · {scorecard.total}</h4>
      </div>
    </div>

    <section className="box-cricket-scorecard-section">
      <h5>Batting</h5>
      <div className="box-cricket-scorecard-table-wrap">
        <table className="box-cricket-scorecard-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.batting.length === 0 ? (
              <tr><td colSpan={6} className="box-cricket-scorecard-empty">No batters yet</td></tr>
            ) : scorecard.batting.map((row) => (
              <tr key={row.id} className={row.status === 'batting' ? 'is-active-row' : ''}>
                <td>{row.name}</td>
                <td>{row.runs}</td>
                <td>{row.balls}</td>
                <td>{row.fours}</td>
                <td>{row.sixes}</td>
                <td>{row.status === 'batting' ? 'batting' : row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="box-cricket-scorecard-section">
      <h5>Bowling</h5>
      <div className="box-cricket-scorecard-table-wrap">
        <table className="box-cricket-scorecard-table">
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.bowling.length === 0 ? (
              <tr><td colSpan={4} className="box-cricket-scorecard-empty">No bowlers yet</td></tr>
            ) : scorecard.bowling.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.overs}</td>
                <td>{row.runs}</td>
                <td>{row.wickets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {scorecard.fallOfWickets.length > 0 && (
      <section className="box-cricket-scorecard-section">
        <h5>Fall of wickets</h5>
        <p className="box-cricket-fow-list">
          {scorecard.fallOfWickets.map((entry) => (
            <span key={`${entry.wicket}-${entry.batterId}`} className="box-cricket-fow-chip">
              {entry.wicket}-{entry.score} {entry.batterName}
            </span>
          ))}
        </p>
      </section>
    )}

    {scorecard.extras > 0 && (
      <p className="box-cricket-scorecard-extras">Extras {scorecard.extras}</p>
    )}
  </div>
);

export default BoxCricketInningsScorecard;
