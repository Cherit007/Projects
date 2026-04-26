import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import { parsePlayerPool, runSnakeDraft } from '../utils/draft';

const TeamEntry = ({
  teams,
  setTeams,
  gameMode,
  playerDatabase,
  teamNameDatabase = [],
  onGenerate,
  onSchedule = () => {},
  loading,
  getActionPending = () => false,
  onBack,
  oddPlayerEnabled = false,
  setOddPlayerEnabled = () => {},
  oddPlayerName = '',
  setOddPlayerName = () => {},
}) => {
  const [snakeDraftEnabled, setSnakeDraftEnabled] = useState(false);
  const [draftPoolInput, setDraftPoolInput] = useState('');
  const [draftError, setDraftError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  const isActionPending = (actionKey) => Boolean(getActionPending?.(actionKey));
  const generatePending = Boolean(loading || isActionPending('teams.generate'));
  const schedulePending = isActionPending('teams.schedule');

  const defaultDraftPool = useMemo(
    () => [...new Set((playerDatabase || []).map((name) => String(name || '').trim()).filter(Boolean))].join(', '),
    [playerDatabase]
  );

  const normalizeValue = (value) => String(value || '').trim().toLowerCase();
  const selectedTeamNames = useMemo(() => (
    teams
      .map((team, index) => ({ index, value: normalizeValue(team?.name) }))
      .filter(item => item.value)
  ), [teams]);
  const selectedPlayerSlots = useMemo(() => (
    teams.flatMap((team, index) => {
      if (gameMode === 'singles') {
        const playerName = team?.player || team?.player1;
        return [{ key: `${index}:player1`, value: normalizeValue(playerName) }];
      }
      return [
        { key: `${index}:player1`, value: normalizeValue(team?.player1) },
        { key: `${index}:player2`, value: normalizeValue(team?.player2) },
      ];
    }).filter(item => item.value)
  ), [teams, gameMode]);

  const getTeamNameSuggestions = (teamIndex) => {
    const currentValue = normalizeValue(teams[teamIndex]?.name);
    const usedByOthers = new Set(
      selectedTeamNames
        .filter(item => item.index !== teamIndex && item.value !== currentValue)
        .map(item => item.value)
    );
    return (teamNameDatabase || []).filter((name) => {
      const normalized = normalizeValue(name);
      return !normalized || !usedByOthers.has(normalized) || normalized === currentValue;
    });
  };

  const getPlayerSuggestions = (teamIndex, slot) => {
    const key = `${teamIndex}:${slot}`;
    const currentEntry = selectedPlayerSlots.find(item => item.key === key);
    const currentValue = currentEntry?.value || '';
    const usedByOthers = new Set(
      selectedPlayerSlots
        .filter(item => item.key !== key && item.value !== currentValue)
        .map(item => item.value)
    );
    return (playerDatabase || []).filter((name) => {
      const normalized = normalizeValue(name);
      return !normalized || !usedByOthers.has(normalized) || normalized === currentValue;
    });
  };

  const slotsPerTeam = gameMode === 'singles' ? 1 : 2;
  const requiredPlayersForDraft = teams.length * slotsPerTeam;
  const oddPlayerDraftEnabled = gameMode !== 'singles' && oddPlayerEnabled;
  const requiredPlayersLabel = oddPlayerDraftEnabled
    ? `${requiredPlayersForDraft} + 1 odd player`
    : `${requiredPlayersForDraft}`;

  const applySnakeDraft = () => {
    const pool = parsePlayerPool(draftPoolInput || defaultDraftPool);
    const result = runSnakeDraft({
      teams,
      gameMode,
      playerPool: pool,
      captains: [],
    });
    if (!result.ok) {
      setDraftError(result.reason || 'Unable to run draft');
      return;
    }
    setTeams(result.teams);

    if (oddPlayerDraftEnabled) {
      const draftedPlayers = new Set(
        result.teams.flatMap((team) => [
          team?.player || team?.player1,
          team?.player2,
        ].map((name) => normalizeValue(name)).filter(Boolean))
      );
      const leftoverPlayers = pool.filter((name) => !draftedPlayers.has(normalizeValue(name)));

      if (!oddPlayerName.trim() && leftoverPlayers.length > 0) {
        setOddPlayerName(leftoverPlayers[0]);
      }
    }

    setDraftError('');
  };

  const canGenerate = !generatePending
    && !teams.some(t => !t.name || (!t.player && !t.player1) || (gameMode !== 'singles' && !t.player2))
    && (!(gameMode !== 'singles' && oddPlayerEnabled) || oddPlayerName.trim());

  return (
    <div className="theme-page py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="theme-card rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Enter Team Details</h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                {playerDatabase.length > 0 || teamNameDatabase.length > 0 ? (
                  <>
                    <ChevronDown size={14} className="text-blue-500" />
                    Suggestions: {playerDatabase.length} players, {teamNameDatabase.length} team names
                  </>
                ) : (
                  'Player and team names will be saved for future use'
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
                    <div className="flex-1">
                      <AutocompleteInput
                        value={team.name}
                        onChange={(value) => {
                          const newTeams = [...teams];
                          newTeams[index].name = value;
                          setTeams(newTeams);
                        }}
                        placeholder="Team Name"
                        playerDatabase={getTeamNameSuggestions(index)}
                        className="font-semibold"
                      />
                    </div>
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
                        playerDatabase={getPlayerSuggestions(index, 'player1')}
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
                          playerDatabase={getPlayerSuggestions(index, 'player1')}
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
                          playerDatabase={getPlayerSuggestions(index, 'player2')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="snake-draft-panel mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <label className="snake-draft-label flex items-center gap-2 text-sm font-semibold text-blue-900">
              <input
                type="checkbox"
                checked={snakeDraftEnabled}
                onChange={(event) => setSnakeDraftEnabled(event.target.checked)}
              />
              Enable Snake Draft
            </label>
            {snakeDraftEnabled && (
              <>
                <p className="snake-draft-note mt-1 text-xs text-blue-800">
                  Auto-fill teams from a player pool, then edit manually if needed.
                </p>
                <div className="mt-3 space-y-2">
                  <textarea
                    value={draftPoolInput}
                    onChange={(event) => setDraftPoolInput(event.target.value)}
                    placeholder={defaultDraftPool || 'Enter players separated by comma/new line'}
                    rows={3}
                    className="snake-draft-textarea w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-500 outline-none bg-white"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="snake-draft-note text-[11px] text-blue-800">
                      Required players: {requiredPlayersLabel} ({teams.length} teams x {slotsPerTeam})
                    </p>
                    <button
                      type="button"
                      onClick={applySnakeDraft}
                      className="snake-draft-run px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all"
                    >
                      Run Snake Draft
                    </button>
                  </div>
                  {draftError && (
                    <p className="text-xs text-red-600">{draftError}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {gameMode !== 'singles' && (
            <div className="odd-rotation-panel mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="odd-rotation-label flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={oddPlayerEnabled}
                  onChange={(event) => setOddPlayerEnabled(event.target.checked)}
                />
                Enable odd player rotation mode
              </label>
              <p className="odd-rotation-note mt-1 text-xs text-slate-600">
                Use this when you have one extra doubles player (example: 7 players for 3 teams).
                Each league round shuffles the six team players, forms fresh pairs, then swaps the extra player into one random active slot.
              </p>
              {oddPlayerEnabled && (
                <div className="mt-3">
                  <AutocompleteInput
                    value={oddPlayerName}
                    onChange={setOddPlayerName}
                    placeholder="Odd player name"
                    playerDatabase={playerDatabase}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => onGenerate({
                oddPlayerEnabled,
                oddPlayerName: oddPlayerName.trim(),
                oddPlayerConfig: {
                  oddPlayerEnabled,
                  oddPlayerName: oddPlayerName.trim(),
                },
              })}
              disabled={!canGenerate}
              className="btn-brand w-full py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Calendar size={20} />
              {generatePending ? 'Generating...' : 'Generate Tournament'}
            </button>

            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              disabled={!canGenerate || schedulePending}
              className="w-full py-4 rounded-xl bg-slate-800 text-white font-semibold text-lg hover:bg-slate-900 hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schedulePending ? 'Scheduling...' : 'Schedule Match'}
            </button>
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 app-modal-shell schedule-modal-shell">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Schedule Tournament</h3>
            <p className="text-sm text-gray-600 mb-4">
              Teams and players from this page will be saved as scheduled.
            </p>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              className="w-full px-3 py-2 mb-4 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                disabled={schedulePending}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void onSchedule({
                    oddPlayerEnabled,
                    oddPlayerName: oddPlayerName.trim(),
                    oddPlayerConfig: {
                      oddPlayerEnabled,
                      oddPlayerName: oddPlayerName.trim(),
                    },
                    scheduledAt: scheduleAt || null,
                  });
                  if (!schedulePending) {
                    setShowScheduleModal(false);
                  }
                }}
                disabled={schedulePending}
                className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {schedulePending ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamEntry;
