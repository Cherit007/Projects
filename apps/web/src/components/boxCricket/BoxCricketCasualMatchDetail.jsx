import React, { useMemo, useState } from 'react';
import { Trophy, Star, X } from 'lucide-react';
import { buildCasualMatchDetail } from '@fixture-maker/domain/sports/boxCricket/casualMatchDetail';
import { formatCasualSeriesScoreLine } from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import BoxCricketInningsScorecard from './BoxCricketInningsScorecard';
import MobileBottomSheet from '../common/MobileBottomSheet';

const SummaryInningsCard = ({ teamName, summary }) => (
  <div className="box-cricket-summary-innings-card">
    <p className="box-cricket-summary-innings-team">{teamName}</p>
    <p className="box-cricket-summary-innings-score">
      {summary.runs}/{summary.wickets}
      <span className="box-cricket-summary-innings-overs"> ({summary.overs} ov)</span>
    </p>
  </div>
);

const PlayerStatsSection = ({ playerStats }) => {
  if (!playerStats) return null;
  const { batters, bowlers } = playerStats;
  if (batters.length === 0 && bowlers.length === 0) return null;

  return (
    <section className="box-cricket-match-detail-player-stats">
      <h4 className="box-cricket-match-detail-section-title">
        <Star size={16} aria-hidden />
        Player stats
      </h4>
      {batters.length > 0 && (
        <div className="box-cricket-scorecard-section">
          <h5>Batting</h5>
          <div className="box-cricket-scorecard-table-wrap">
            <table className="box-cricket-scorecard-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>R</th>
                  <th>B</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>Inn</th>
                </tr>
              </thead>
              <tbody>
                {batters.map((row) => (
                  <tr key={row.id || row.name}>
                    <td>{row.name}</td>
                    <td>{row.runs}</td>
                    <td>{row.balls}</td>
                    <td>{row.fours}</td>
                    <td>{row.sixes}</td>
                    <td>{row.innings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {bowlers.length > 0 && (
        <div className="box-cricket-scorecard-section">
          <h5>Bowling</h5>
          <div className="box-cricket-scorecard-table-wrap">
            <table className="box-cricket-scorecard-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>O</th>
                  <th>R</th>
                  <th>W</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map((row) => (
                  <tr key={row.id || row.name}>
                    <td>{row.name}</td>
                    <td>{row.overs}</td>
                    <td>{row.runs}</td>
                    <td>{row.wickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

const GameDetail = ({ game, showGameLabel }) => {
  const { highlights, scoringMode, scorecard1, scorecard2, firstBattingTeam, secondBattingTeam } = game;

  return (
    <div className="box-cricket-match-detail-game">
      {showGameLabel && (
        <p className="box-cricket-match-detail-game-label">Game {game.gameNo}</p>
      )}

      {highlights && (
        <div className="box-cricket-match-result-banner box-cricket-match-detail-banner">
          <Trophy size={22} aria-hidden />
          <div>
            <h4 className="box-cricket-match-result-title">
              {highlights.winnerTeam?.name || 'Winner'} wins
            </h4>
            <p className="box-cricket-match-result-summary">{highlights.summary}</p>
            {highlights.chaseWon && (
              <p className="box-cricket-match-result-chase">Target chased down</p>
            )}
          </div>
        </div>
      )}

      {scoringMode === 'ballByBall' ? (
        <div className="box-cricket-match-result-scorecards">
          <BoxCricketInningsScorecard
            scorecard={scorecard1}
            battingTeamName={`${firstBattingTeam?.name || 'Team'} · 1st inn`}
          />
          <BoxCricketInningsScorecard
            scorecard={scorecard2}
            battingTeamName={`${secondBattingTeam?.name || 'Team'} · 2nd inn`}
          />
        </div>
      ) : (
        <div className="box-cricket-summary-innings-grid">
          <SummaryInningsCard
            teamName={`${firstBattingTeam?.name || 'Team 1'} · 1st inn`}
            summary={game.innings1Summary}
          />
          <SummaryInningsCard
            teamName={`${secondBattingTeam?.name || 'Team 2'} · 2nd inn`}
            summary={game.innings2Summary}
          />
        </div>
      )}

      {scoringMode === 'ballByBall' && highlights?.topBatter && (
        <div className="box-cricket-match-highlights box-cricket-match-detail-highlights">
          <div className="box-cricket-match-highlights-grid">
            <div className="box-cricket-highlight-card">
              <span className="box-cricket-highlight-label">Top batter</span>
              <strong className="box-cricket-highlight-name">{highlights.topBatter.name}</strong>
              <span className="box-cricket-highlight-stat">
                {highlights.topBatter.runs} ({highlights.topBatter.balls})
              </span>
            </div>
            {highlights.topBowler && (
              <div className="box-cricket-highlight-card">
                <span className="box-cricket-highlight-label">Top bowler</span>
                <strong className="box-cricket-highlight-name">{highlights.topBowler.name}</strong>
                <span className="box-cricket-highlight-stat">
                  {highlights.topBowler.wickets}/{highlights.topBowler.overs}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BoxCricketCasualMatchDetailBody = ({ match, formatTeamName, formatScoreLine }) => {
  const detail = useMemo(() => buildCasualMatchDetail(match), [match]);
  const [activeGameIndex, setActiveGameIndex] = useState(0);

  if (!detail) {
    return (
      <div className="box-cricket-match-detail-empty">
        <p>No detailed scorecard available for this match.</p>
      </div>
    );
  }

  const team1Name = formatTeamName(detail.team1, match);
  const team2Name = formatTeamName(detail.team2, match);
  const activeGame = detail.games[activeGameIndex] || detail.games[0];
  const showGameTabs = detail.games.length > 1;

  return (
    <div className="box-cricket-match-detail">
      <div className="box-cricket-match-detail-header">
        <p className="box-cricket-match-detail-meta">
          {new Date(match.date || match.completedAt || match.createdAt || Date.now()).toLocaleString()}
        </p>
        <h3 className="box-cricket-match-detail-matchup">
          {team1Name} vs {team2Name}
        </h3>
        <p className="box-cricket-match-detail-scoreline">
          {formatScoreLine(match, team1Name, team2Name)}
        </p>
        {detail.series?.winnerTeam && (
          <p className="box-cricket-match-detail-series-winner">
            <Trophy size={14} aria-hidden />
            {detail.series.winnerTeam.name} won the {detail.series.label || 'series'}
          </p>
        )}
      </div>

      {showGameTabs && (
        <div className="box-cricket-match-detail-game-tabs">
          {detail.games.map((game, index) => (
            <button
              key={game.gameNo || index}
              type="button"
              className={`box-cricket-match-detail-game-tab ${index === activeGameIndex ? 'is-active' : ''}`}
              onClick={() => setActiveGameIndex(index)}
            >
              Game {game.gameNo || index + 1}
            </button>
          ))}
        </div>
      )}

      {activeGame && (
        <GameDetail game={activeGame} showGameLabel={showGameTabs} />
      )}

      <PlayerStatsSection playerStats={detail.playerStats} />
    </div>
  );
};

const BoxCricketCasualMatchDetail = ({
  match,
  onClose,
  isMobileViewport = false,
  formatTeamName = (team) => team?.name || 'Team',
  formatScoreLine = (entry, team1Name, team2Name) => (
    formatCasualSeriesScoreLine(entry.statistics, team1Name, team2Name)
      || `${entry.score1} - ${entry.score2}`
  ),
}) => {
  if (!match) return null;

  if (isMobileViewport) {
    return (
      <MobileBottomSheet
        open
        title="Match details"
        subtitle={formatTeamName(match.team1, match)}
        onClose={onClose}
        sheetClassName="box-cricket-match-detail-shell"
      >
        <BoxCricketCasualMatchDetailBody
          match={match}
          formatTeamName={formatTeamName}
          formatScoreLine={formatScoreLine}
        />
      </MobileBottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[250] p-4 app-overlay">
      <div className="rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden box-cricket-match-detail-shell app-modal-shell">
        <div className="app-gradient-band p-5 flex items-center justify-between setup-modal-header setup-modal-header-casual">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy size={22} /> Box Cricket Match
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close match details"
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-76px)]">
          <BoxCricketCasualMatchDetailBody
            match={match}
            formatTeamName={formatTeamName}
            formatScoreLine={formatScoreLine}
          />
        </div>
      </div>
    </div>
  );
};

export default BoxCricketCasualMatchDetail;
