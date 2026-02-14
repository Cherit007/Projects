import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

const TeamEntry = ({
  teams,
  setTeams,
  gameMode,
  playerDatabase,
  onGenerate,
  loading,
  onBack
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Enter Team Details</h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                {playerDatabase.length > 0 ? (
                  <>
                    <ChevronDown size={14} className="text-blue-500" />
                    Start typing to see {playerDatabase.length} saved names
                  </>
                ) : (
                  'Player names will be saved for future use'
                )}
              </p>
            </div>
            <button onClick={onBack} className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1">
              ← Back
            </button>
          </div>

          {teams.length > 0 && (
            <div className="space-y-4 mb-6">
              {teams.map((team, index) => (
                <div key={team.id} className="border-2 border-gray-200 rounded-2xl p-4 md:p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-3xl bg-gray-50 rounded-xl p-3 cursor-pointer" onClick={() => {
                      const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀', '👑', '🌊', '🏆', '⭐', '🎨', '🌈', '💪', '🎪', '🎭'];
                      const currentIndex = emojis.indexOf(team.emoji);
                      const nextEmoji = emojis[(currentIndex + 1) % emojis.length];
                      const newTeams = [...teams];
                      newTeams[index].emoji = nextEmoji;
                      setTeams(newTeams);
                    }}>
                      {team.emoji}
                    </div>
                    <input type="text" value={team.name} onChange={(e) => {
                      const newTeams = [...teams];
                      newTeams[index].name = e.target.value;
                      setTeams(newTeams);
                    }} placeholder="Team Name" className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-semibold" />
                  </div>
                  
                  {gameMode === 'singles' ? (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                        Player Name
                        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                      </label>
                      <AutocompleteInput
                        value={team.player || team.player1}
                        onChange={(value) => {
                          const newTeams = [...teams];
                          newTeams[index].player = value;
                          newTeams[index].player1 = value;
                          setTeams(newTeams);
                        }}
                        placeholder="Player Name"
                        playerDatabase={playerDatabase}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                          {gameMode === 'mixed' ? 'Player 1 (Male/Female)' : 'Player 1'}
                          {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                        </label>
                        <AutocompleteInput
                          value={team.player1}
                          onChange={(value) => {
                            const newTeams = [...teams];
                            newTeams[index].player1 = value;
                            setTeams(newTeams);
                          }}
                          placeholder="Player 1 Name"
                          playerDatabase={playerDatabase}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                          {gameMode === 'mixed' ? 'Player 2 (Male/Female)' : 'Player 2'}
                          {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                        </label>
                        <AutocompleteInput
                          value={team.player2}
                          onChange={(value) => {
                            const newTeams = [...teams];
                            newTeams[index].player2 = value;
                            setTeams(newTeams);
                          }}
                          placeholder="Player 2 Name"
                          playerDatabase={playerDatabase}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={onGenerate}
            disabled={loading || teams.some(t => !t.name || (!t.player && !t.player1) || (gameMode !== 'singles' && !t.player2))}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Calendar size={20} />
            {loading ? 'Generating...' : 'Generate Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamEntry;