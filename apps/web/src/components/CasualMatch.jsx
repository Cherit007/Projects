import React, { useState } from 'react';
import { Users, Trophy, TrendingUp } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import CasualMatchShell from './setup/CasualMatchShell';

const CasualMatch = ({
  playerDatabase,
  playerRatings,
  onSaveMatch,
  onAddPlayer,
  onClose,
  sportId = 'badminton',
  layout = 'modal',
}) => {
  const [matchType, setMatchType] = useState('singles'); // singles or doubles
  const [team1Player1, setTeam1Player1] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Player1, setTeam2Player1] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [saving, setSaving] = useState(false);

  const getPlayerRating = (playerName) => {
    return playerRatings[playerName]?.rating || 1000;
  };

  const team1Rating = matchType === 'singles' 
    ? getPlayerRating(team1Player1)
    : Math.round((getPlayerRating(team1Player1) + getPlayerRating(team1Player2)) / 2);

  const team2Rating = matchType === 'singles'
    ? getPlayerRating(team2Player1)
    : Math.round((getPlayerRating(team2Player1) + getPlayerRating(team2Player2)) / 2);

  const canSave = () => {
    if (matchType === 'singles') {
      return team1Player1 && team2Player1 && score1 && score2 && score1 !== score2;
    } else {
      return team1Player1 && team1Player2 && team2Player1 && team2Player2 && 
             score1 && score2 && score1 !== score2;
    }
  };

  const handleSave = async () => {
    if (!canSave()) return;

    setSaving(true);

    const matchData = {
      type: 'casual',
      sportId,
      matchType,
      date: new Date().toISOString(),
      team1: matchType === 'singles' 
        ? { player: team1Player1 }
        : { player1: team1Player1, player2: team1Player2 },
      team2: matchType === 'singles'
        ? { player: team2Player1 }
        : { player1: team2Player1, player2: team2Player2 },
      score1: parseInt(score1),
      score2: parseInt(score2),
    };

    // Add new players to database
onAddPlayer(team1Player1);
onAddPlayer(team2Player1);
if (matchType === 'doubles') {
  onAddPlayer(team1Player2);
  onAddPlayer(team2Player2);
}

    await onSaveMatch(matchData);
    
    setSaving(false);
    
    // Reset form
    setTeam1Player1('');
    setTeam1Player2('');
    setTeam2Player1('');
    setTeam2Player2('');
    setScore1('');
    setScore2('');
  };

  return (
    <CasualMatchShell
      layout={layout}
      title="Casual Match"
      subtitle="Track a one-off result and update ELO rankings"
      icon={Users}
      onClose={onClose}
    >
          {/* Match Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Match Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMatchType('singles')}
                className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                  matchType === 'singles'
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🎯 Singles
              </button>
              <button
                onClick={() => setMatchType('doubles')}
                className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                  matchType === 'doubles'
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                👥 Doubles
              </button>
            </div>
          </div>

          {/* Teams Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Team 1 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-300 casual-team-card casual-team-card-one">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-bold text-gray-800">Team 1</h3>
                {team1Player1 && (
                  <span className="ml-auto text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full font-bold">
                    <TrendingUp size={12} className="inline mr-1" />
                    {team1Rating}
                  </span>
                )}
              </div>

              <div className="space-y-3">
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      Player {matchType === 'doubles' ? '1' : ''}
    </label>
    <AutocompleteInput
      value={team1Player1}
      onChange={setTeam1Player1}
      placeholder="Enter player name"
      playerDatabase={playerDatabase}
    />
  </div>

  {matchType === 'doubles' && (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        Player 2
      </label>
      <AutocompleteInput
        value={team1Player2}
        onChange={setTeam1Player2}
        placeholder="Enter player name"
        playerDatabase={playerDatabase}
      />
    </div>
  )}

  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      Score
    </label>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={score1}
      onChange={(e) => {
        const value = e.target.value;
        if (value === '' || /^\d+$/.test(value)) {
          setScore1(value);
        }
      }}
      placeholder="21"
      className="w-full px-4 py-3 border-2 border-blue-400 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none text-center text-2xl font-bold"
    />
  </div>
</div>
            </div>

            {/* Team 2 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-300 casual-team-card casual-team-card-two">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-bold text-gray-800">Team 2</h3>
                {team2Player1 && (
                  <span className="ml-auto text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full font-bold">
                    <TrendingUp size={12} className="inline mr-1" />
                    {team2Rating}
                  </span>
                )}
              </div>

              <div className="space-y-3">
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      Player {matchType === 'doubles' ? '1' : ''}
    </label>
    <AutocompleteInput
      value={team2Player1}
      onChange={setTeam2Player1}
      placeholder="Enter player name"
      playerDatabase={playerDatabase}
    />
  </div>

  {matchType === 'doubles' && (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        Player 2
      </label>
      <AutocompleteInput
        value={team2Player2}
        onChange={setTeam2Player2}
        placeholder="Enter player name"
        playerDatabase={playerDatabase}
      />
    </div>
  )}

  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      Score
    </label>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={score2}
      onChange={(e) => {
        const value = e.target.value;
        if (value === '' || /^\d+$/.test(value)) {
          setScore2(value);
        }
      }}
      placeholder="18"
      className="w-full px-4 py-3 border-2 border-purple-400 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-center text-2xl font-bold"
    />
  </div>
</div>
            </div>
          </div>

          {/* Validation Messages */}
          {score1 && score2 && score1 === score2 && (
            <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-3 text-center casual-validation-box">
              <p className="text-red-700 font-semibold text-sm">
                ⚠️ Scores must be different
              </p>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!canSave() || saving}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Saving Match...</span>
              </>
            ) : (
              <>
                <Trophy size={24} />
                <span>Save Match & Update ELO</span>
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-3 casual-info-box">
            <p className="text-xs text-blue-700">
              💡 <strong>Note:</strong> This match will be recorded in history and will update player ELO ratings automatically.
            </p>
          </div>
    </CasualMatchShell>
  );
};

export default CasualMatch;
