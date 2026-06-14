import React from 'react';
import { X, Trophy, Users, Calendar } from 'lucide-react';
import { formatTournamentDateLabel } from '../utils/appHelpers';

const TournamentViewer = ({ tournament, onClose }) => {
  if (!tournament) return null;

  // Comprehensive safety checks
  let teams = [];
  let fixtures = [];
  let champion = null;
  let finalMatch = null;
  let bracket = null;
  let tournamentName = 'Tournament';
  let tournamentDate = '';

  try {
    teams = Array.isArray(tournament.teams) ? tournament.teams : [];
    fixtures = Array.isArray(tournament.fixtures) ? tournament.fixtures : [];
    champion = tournament.champion || null;
    finalMatch = tournament.finalMatch || null;
    bracket = tournament.bracket || null;
    tournamentName = tournament.name || 'Tournament';
    tournamentDate = formatTournamentDateLabel(tournament.date, '');
  } catch (error) {
    console.error('Error parsing tournament data:', error);
  }

  const allMatches = [
    ...fixtures,
    ...(finalMatch ? [finalMatch] : [])
  ].filter(m => m && typeof m === 'object');

  // Extract bracket matches if present
  let bracketMatches = [];
  let scheduledBracketMatches = [];
  try {
    if (bracket && Array.isArray(bracket)) {
      bracket.forEach((round, roundIdx) => {
        if (Array.isArray(round)) {
          round.forEach(match => {
            if (match && match.team1 && match.team2) {
              const roundName = roundIdx === 0 ? 'Quarter Finals' :
                roundIdx === 1 ? 'Semi Finals' : 'Final';
              const normalized = { ...match, roundName };
              if (match.completed) {
                bracketMatches.push(normalized);
              } else {
                scheduledBracketMatches.push(normalized);
              }
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('Error parsing bracket:', error);
  }

  const completedMatches = allMatches.filter(m => 
    m && 
    m.completed && 
    m.team1 && 
    m.team2 && 
    typeof m.score1 === 'number' && 
    typeof m.score2 === 'number'
  );

  const scheduledLeagueMatches = allMatches.filter((match) => (
    match
    && !match.completed
    && match.team1
    && match.team2
  ));

  const scheduledMatches = [
    ...scheduledLeagueMatches.map((match) => ({
      ...match,
      roundName: match?.id === 'final' ? 'Final' : 'League Match',
    })),
    ...scheduledBracketMatches,
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden tournament-viewer-shell app-modal-shell">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-4 sm:p-6 flex items-center justify-between tournament-viewer-header">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Trophy size={24} /> {tournamentName}
            </h3>
            <p className="text-xs sm:text-sm text-white opacity-90 mt-1">
              <Calendar size={14} className="inline mr-1" />
              {tournamentDate}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)] tournament-viewer-content">
          {/* Champion */}
          {champion && (
            <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6 mb-6 text-center tournament-viewer-champion">
              <div className="text-4xl sm:text-6xl mb-3">🏆</div>
              <h4 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2">CHAMPIONS</h4>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl sm:text-4xl">{champion.emoji}</span>
                <div>
                  <p className="font-bold text-base sm:text-xl text-gray-800">{champion.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {champion.player || champion.player1}
                    {champion.player2 && ` & ${champion.player2}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Teams */}
          <div className="mb-6">
            <h4 className="font-bold text-base sm:text-lg text-gray-800 mb-3 flex items-center gap-2">
              <Users size={18} /> Teams ({teams.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teams.map((team, idx) => (
                <div key={idx} className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 tournament-viewer-team-card">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{team.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-gray-800 truncate">{team.name}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {team.player || team.player1}
                        {team.player2 && ` & ${team.player2}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Matches */}
          {bracketMatches.length > 0 ? (
            <div>
              <h4 className="font-bold text-base sm:text-lg text-gray-800 mb-3">Bracket Matches</h4>
              <div className="space-y-3">
                {bracketMatches.map((match, idx) => {
                  if (!match || !match.team1 || !match.team2) return null;
                  return (
                    <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-3 sm:p-4 tournament-viewer-match-card">
                      <p className="text-xs text-gray-500 mb-2 font-semibold">{match.roundName || 'Match'}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl">{match.team1.emoji || '🏸'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match.team1.name || 'Team'}</p>
                          </div>
                          <span className={`text-lg sm:text-xl font-bold ${match.score1 > match.score2 ? 'text-green-600' : 'text-gray-400'}`}>
                            {match.score1 ?? '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl">{match.team2.emoji || '🏸'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match.team2.name || 'Team'}</p>
                          </div>
                          <span className={`text-lg sm:text-xl font-bold ${match.score2 > match.score1 ? 'text-green-600' : 'text-gray-400'}`}>
                            {match.score2 ?? '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : completedMatches.length > 0 && (
            <div>
              <h4 className="font-bold text-base sm:text-lg text-gray-800 mb-3">Match Results ({completedMatches.length})</h4>
              <div className="space-y-3">
                {completedMatches.map((match, idx) => {
                  if (!match || !match.team1 || !match.team2) return null;
                  return (
                    <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-3 sm:p-4 tournament-viewer-match-card">
                      {match.id === 'final' && (
                        <p className="text-xs text-yellow-600 mb-2 font-bold">⭐ FINAL MATCH</p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl">{match.team1.emoji || '🏸'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match.team1.name || 'Team'}</p>
                          </div>
                          <span className={`text-lg sm:text-xl font-bold ${match.score1 > match.score2 ? 'text-green-600' : 'text-gray-400'}`}>
                            {match.score1 ?? '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl">{match.team2.emoji || '🏸'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match.team2.name || 'Team'}</p>
                          </div>
                          <span className={`text-lg sm:text-xl font-bold ${match.score2 > match.score1 ? 'text-green-600' : 'text-gray-400'}`}>
                            {match.score2 ?? '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {scheduledMatches.length > 0 && (
            <div className={bracketMatches.length > 0 || completedMatches.length > 0 ? 'mt-6' : ''}>
              <h4 className="font-bold text-base sm:text-lg text-gray-800 mb-3">
                Scheduled Fixtures ({scheduledMatches.length})
              </h4>
              <div className="space-y-3">
                {scheduledMatches.map((match, idx) => (
                  <div key={`scheduled-match-${idx}`} className="bg-white border-2 border-indigo-200 rounded-xl p-3 sm:p-4 tournament-viewer-match-card">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">{match.roundName || 'Match'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl">{match?.team1?.emoji || '🏸'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match?.team1?.name || 'Team'}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-400">-</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl">{match?.team2?.emoji || '🏸'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{match?.team2?.name || 'Team'}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-400">-</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {bracketMatches.length === 0 && completedMatches.length === 0 && scheduledMatches.length === 0 && (
            <div className="text-center py-12 text-gray-500 tournament-viewer-empty">
              <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No match results available for this tournament</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentViewer;
