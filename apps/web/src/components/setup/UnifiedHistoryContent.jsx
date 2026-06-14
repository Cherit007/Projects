import React from 'react';
import { History, Trophy } from 'lucide-react';
import { formatTournamentDateLabel } from '../../utils/appHelpers';
import { hasViewableBoxCricketDetail } from '../../utils/casualMatchHydration';

const HistoryTypeBadge = ({ type }) => (
  <span className={`history-entry-type-badge history-entry-type-${type}`}>
    {type === 'tournament' ? 'Tournament' : 'Casual'}
  </span>
);

const TournamentHistoryCard = ({
  tournament,
  index,
  onView,
  onDelete,
  canDeleteActions,
  deletePending,
}) => {
  const tournamentId = tournament.id || tournament.appwriteId;
  return (
    <div
      key={tournamentId || `${tournament.name || 'history'}-${index}`}
      className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-gradient-to-r from-white to-gray-50 history-entry-card"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <HistoryTypeBadge type="tournament" />
            <h4 className="font-bold text-lg text-gray-800">{tournament.name}</h4>
          </div>
          <p className="text-xs text-gray-500">
            {formatTournamentDateLabel(tournament.date)} • {tournament.teams?.length || 0} teams
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onView(tournament)}
            className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap"
          >
            View
          </button>
          {canDeleteActions && (
            <button
              type="button"
              onClick={() => onDelete?.(tournamentId)}
              disabled={!tournamentId || deletePending}
              className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletePending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
      {tournament.champion && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-2 border-yellow-200 history-champion-card">
          <span className="text-3xl">{tournament.champion.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-800 flex items-center gap-2">
              <Trophy size={16} className="text-yellow-600" />
              {tournament.champion.name}
            </p>
            <p className="text-xs text-gray-600">
              {tournament.champion.player || tournament.champion.player1}
              {tournament.champion.player2 && ` & ${tournament.champion.player2}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CasualHistoryCard = ({
  match,
  index,
  team1Name,
  team2Name,
  scoreLine,
  metaLine,
  onView,
  onDelete,
  canDeleteActions,
  deletePending,
  showView = false,
}) => {
  const matchId = match.id || match.appwriteId;
  const score1 = Number(match.score1);
  const score2 = Number(match.score2);
  const isTeam1Winner = score1 > score2;

  return (
    <div
      key={matchId || index}
      className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white to-gray-50 casual-history-card history-entry-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <HistoryTypeBadge type="casual" />
            <p className="text-xs text-gray-500 casual-history-meta">{metaLine}</p>
          </div>
          <p className="font-semibold text-gray-800 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] leading-snug break-words">
            <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span>
            {' vs '}
            <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
          </p>
          <p className="text-sm text-gray-700 mt-1 casual-history-score">Score: {scoreLine}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {showView && (
            <button
              type="button"
              onClick={() => onView(match)}
              className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap"
            >
              View
            </button>
          )}
          {canDeleteActions && (
            <button
              type="button"
              onClick={() => onDelete?.(matchId)}
              disabled={!matchId || deletePending}
              className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed casual-history-delete-btn"
            >
              {deletePending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const UnifiedHistoryContent = ({
  entries = [],
  isLoading = false,
  showSkeleton = false,
  onViewTournament,
  onViewCasualMatch,
  onDeleteTournament,
  onDeleteCasualMatch,
  canDeleteActions = false,
  isPendingAction = () => false,
  formatCasualTeam,
  formatCasualMatchMeta,
  formatCasualScoreLine,
}) => {
  if (showSkeleton) {
    return null;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <History size={48} className="mx-auto mb-4 text-gray-300" />
        <p>No history yet</p>
        <p className="text-sm mt-2">Completed tournaments and casual matches will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        if (entry.type === 'tournament') {
          const tournament = entry.tournament;
          const tournamentId = tournament.id || tournament.appwriteId;
          return (
            <TournamentHistoryCard
              key={entry.id}
              tournament={tournament}
              index={entry.id}
              onView={onViewTournament}
              onDelete={onDeleteTournament}
              canDeleteActions={canDeleteActions}
              deletePending={Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`))}
            />
          );
        }

        const match = entry.match;
        const team1Name = formatCasualTeam(match.team1, match);
        const team2Name = formatCasualTeam(match.team2, match);
        const matchId = match.id || match.appwriteId;
        const showView = hasViewableBoxCricketDetail(match);

        return (
          <CasualHistoryCard
            key={entry.id}
            match={match}
            index={entry.id}
            team1Name={team1Name}
            team2Name={team2Name}
            scoreLine={formatCasualScoreLine(match, team1Name, team2Name)}
            metaLine={`${formatCasualMatchMeta(match)} • ${new Date(match.date || match.createdAt || Date.now()).toLocaleString()}`}
            onView={onViewCasualMatch}
            onDelete={onDeleteCasualMatch}
            canDeleteActions={canDeleteActions}
            deletePending={Boolean(matchId && isPendingAction(`setup.delete-casual.${String(matchId)}`))}
            showView={showView}
          />
        );
      })}
      {isLoading && entries.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
          Refreshing latest history...
        </div>
      )}
    </div>
  );
};

export default UnifiedHistoryContent;
