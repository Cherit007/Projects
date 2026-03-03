import React, { useState } from 'react';
import AutocompleteInput from './AutocompleteInput';

const tournamentFormatOptions = [
  { value: 'league', label: '📊 League + Final' },
  { value: 'knockoutByes', label: '🏆 Knockout + Byes (3+ teams)' },
  { value: 'semiFinal', label: '🏆 Semi Final + Final (4 teams)' },
  { value: 'fullKnockout', label: '⚔️ Full Knockout (8 teams)' },
];

const createEmptyTeam = (index, gameMode) => ({
  id: index + 1,
  emoji: '🏸',
  name: '',
  player1: '',
  player2: gameMode === 'singles' ? '' : '',
  player: '',
});

const normalizeTeams = (teams, numTeams, gameMode) => {
  const safeNumTeams = Math.max(3, parseInt(numTeams, 10) || 3);
  return Array.from({ length: safeNumTeams }, (_, index) => {
    const team = teams?.[index];
    if (!team) return createEmptyTeam(index, gameMode);

    const player1 = team.player1 || team.player || '';
    return {
      id: index + 1,
      emoji: team.emoji || '🏸',
      name: team.name || '',
      player1,
      player: player1,
      player2: gameMode === 'singles' ? '' : (team.player2 || ''),
    };
  });
};

const buildDraftFromTemplate = (template, currentConfig) => {
  const base = template || {
    name: '',
    tournamentFormat: currentConfig.tournamentFormat,
    gameMode: currentConfig.gameMode,
    format: currentConfig.format,
    numTeams: currentConfig.numTeams,
    teams: [],
  };

  return {
    id: base.id,
    name: base.name || '',
    tournamentFormat: base.tournamentFormat || 'league',
    gameMode: base.gameMode || 'doubles',
    format: base.format || '1',
    numTeams: Math.max(3, parseInt(base.numTeams, 10) || 3),
    teams: normalizeTeams(base.teams, base.numTeams, base.gameMode || 'doubles'),
  };
};

const TemplateManager = ({
  templates = [],
  currentConfig,
  playerSuggestions = [],
  teamNameSuggestions = [],
  onSave,
  onApply,
  onDelete,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState(buildDraftFromTemplate(null, currentConfig));

  const openCreate = () => {
    setDraft(buildDraftFromTemplate(null, currentConfig));
    setShowEditor(true);
  };

  const openEdit = (template) => {
    setDraft(buildDraftFromTemplate(template, currentConfig));
    setShowEditor(true);
  };

  const setDraftFormat = (value) => {
    let numTeams = draft.numTeams;
    if (value === 'semiFinal') numTeams = 4;
    else if (value === 'fullKnockout') numTeams = 8;
    else if (value === 'knockoutByes') numTeams = Math.max(3, numTeams);
    else numTeams = Math.max(3, numTeams);

    setDraft(prev => ({
      ...prev,
      tournamentFormat: value,
      numTeams,
      teams: normalizeTeams(prev.teams, numTeams, prev.gameMode),
    }));
  };

  const setDraftGameMode = (value) => {
    setDraft(prev => ({
      ...prev,
      gameMode: value,
      teams: normalizeTeams(prev.teams, prev.numTeams, value),
    }));
  };

  const setDraftNumTeams = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    const maxTeams = draft.tournamentFormat === 'league' ? 12 : 16;
    const normalized = Math.max(3, Math.min(maxTeams, parsed));
    setDraft(prev => ({
      ...prev,
      numTeams: normalized,
      teams: normalizeTeams(prev.teams, normalized, prev.gameMode),
    }));
  };

  const updateTeam = (teamIndex, key, value) => {
    setDraft(prev => {
      const updatedTeams = [...prev.teams];
      updatedTeams[teamIndex] = { ...updatedTeams[teamIndex], [key]: value };
      if (prev.gameMode === 'singles' && (key === 'player1' || key === 'player')) {
        updatedTeams[teamIndex].player1 = value;
        updatedTeams[teamIndex].player = value;
      }
      return { ...prev, teams: updatedTeams };
    });
  };

  const handleSave = () => {
    const result = onSave({
      ...draft,
      teams: normalizeTeams(draft.teams, draft.numTeams, draft.gameMode),
    });
    if (result?.success) {
      setShowEditor(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl p-4 template-manager-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-gray-700 template-manager-title">📌 Tournament Templates</p>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 rounded-lg transition-all text-xs font-semibold template-manager-create-btn"
        >
          New Template
        </button>
      </div>

      {templates.length > 0 ? (
        <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
          {templates.map(template => (
            <div key={template.id} className="template-manager-row rounded-lg p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{template.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {template.tournamentFormat} • {template.gameMode} • {template.numTeams} teams
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onApply(template.id)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold template-manager-apply-btn"
                >
                  Apply
                </button>
                <button
                  onClick={() => openEdit(template)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold template-manager-edit-btn"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(template.id)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold template-manager-delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No templates saved yet</p>
      )}

      {showEditor && (
        <div className="mt-4 rounded-xl p-3 space-y-3 template-manager-editor">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Template name"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none text-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={draft.gameMode}
              onChange={(e) => setDraftGameMode(e.target.value)}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none text-sm"
            >
              <option value="doubles">Doubles</option>
              <option value="singles">Singles</option>
              <option value="mixed">Mixed Doubles</option>
            </select>
            <select
              value={draft.tournamentFormat}
              onChange={(e) => setDraftFormat(e.target.value)}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none text-sm"
            >
              {tournamentFormatOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {draft.tournamentFormat === 'league' && (
            <select
              value={draft.format}
              onChange={(e) => setDraft(prev => ({ ...prev, format: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none text-sm"
            >
              <option value="1">1 match per pair</option>
              <option value="2">2 matches per pair</option>
            </select>
          )}

          <input
            type="number"
            min={3}
            max={draft.tournamentFormat === 'league' ? 12 : 16}
            disabled={draft.tournamentFormat === 'semiFinal' || draft.tournamentFormat === 'fullKnockout'}
            value={draft.numTeams}
            onChange={(e) => setDraftNumTeams(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none text-sm disabled:bg-gray-100"
          />

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {draft.teams.map((team, index) => (
              <div key={team.id} className="border border-gray-200 rounded-lg p-2 space-y-2">
                <p className="text-xs font-semibold text-gray-600">Team {index + 1}</p>
                <AutocompleteInput
                  value={team.name}
                  onChange={(value) => updateTeam(index, 'name', value)}
                  placeholder="Team name"
                  playerDatabase={teamNameSuggestions}
                  className="text-sm"
                />
                <AutocompleteInput
                  value={team.player1 || ''}
                  onChange={(value) => updateTeam(index, 'player1', value)}
                  placeholder={draft.gameMode === 'singles' ? 'Player name' : 'Player 1'}
                  playerDatabase={playerSuggestions}
                  className="text-sm"
                />
                {draft.gameMode !== 'singles' && (
                  <AutocompleteInput
                    value={team.player2 || ''}
                    onChange={(value) => updateTeam(index, 'player2', value)}
                    placeholder="Player 2"
                    playerDatabase={playerSuggestions}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
            >
              Save Template
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
