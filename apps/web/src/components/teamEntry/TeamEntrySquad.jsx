import React, { useMemo, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import AutocompleteInput from '../AutocompleteInput';
import { getSport } from '@fixture-maker/domain/sports';
import {
  createSquadPlayer,
  getSquadLimits,
  isSquadTeamValid,
  listSquadPlayerNames,
  normalizeSquad,
  syncLegacyPlayersFromSquad,
} from '@fixture-maker/domain/sports/boxCricket/squadUtils';

const TeamEntrySquad = ({
  teams,
  setTeams,
  sportId = 'boxCricket',
  playerDatabase,
  teamNameDatabase = [],
  onGenerate,
  onSchedule = () => {},
  loading,
  getActionPending = () => false,
  onBack,
}) => {
  const sportConfig = useMemo(() => getSport(sportId), [sportId]);
  const squadLimits = useMemo(() => getSquadLimits(sportConfig), [sportConfig]);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const isActionPending = (actionKey) => Boolean(getActionPending?.(actionKey));
  const generatePending = Boolean(loading || isActionPending('teams.generate'));
  const schedulePending = isActionPending('teams.schedule');

  const normalizeValue = (value) => String(value || '').trim().toLowerCase();

  const getTeamNameSuggestions = (teamIndex) => {
    const currentValue = normalizeValue(teams[teamIndex]?.name);
    const usedByOthers = new Set(
      teams
        .map((team, index) => ({ index, value: normalizeValue(team?.name) }))
        .filter((item) => item.index !== teamIndex && item.value)
        .map((item) => item.value),
    );
    return (teamNameDatabase || []).filter((name) => {
      const normalized = normalizeValue(name);
      return !normalized || !usedByOthers.has(normalized) || normalized === currentValue;
    });
  };

  const getPlayerSuggestions = (teamIndex, playerIndex) => {
    const usedNames = new Set(
      teams.flatMap((team, index) => (
        listSquadPlayerNames(team).map((name) => ({
          key: `${index}:${name}`,
          value: normalizeValue(name),
        }))
      ))
        .filter((entry) => !(entry.key.startsWith(`${teamIndex}:`)))
        .map((entry) => entry.value),
    );
    const currentName = normalizeValue(teams[teamIndex]?.squad?.[playerIndex]?.name);
    return (playerDatabase || []).filter((name) => {
      const normalized = normalizeValue(name);
      return !normalized || !usedNames.has(normalized) || normalized === currentName;
    });
  };

  const updateTeam = (index, updater) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = syncLegacyPlayersFromSquad(updater({ ...next[index] }));
      return next;
    });
  };

  const addPlayer = (teamIndex) => {
    updateTeam(teamIndex, (team) => {
      const squad = Array.isArray(team.squad) ? team.squad : normalizeSquad(team.squad);
      if (squad.length >= squadLimits.maxPlayers) return team;
      return { ...team, squad: [...squad, createSquadPlayer()] };
    });
  };

  const removePlayer = (teamIndex, playerIndex) => {
    updateTeam(teamIndex, (team) => {
      const squad = Array.isArray(team.squad) ? team.squad : normalizeSquad(team.squad);
      if (squad.length <= squadLimits.minPlayers) return team;
      return { ...team, squad: squad.filter((_, index) => index !== playerIndex) };
    });
  };

  const canGenerate = !generatePending
    && teams.length > 0
    && teams.every((team) => isSquadTeamValid(team, sportConfig));

  return (
    <div className="theme-page py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="theme-card rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                {sportConfig.icon} Enter Squad Details
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {squadLimits.minPlayers}–{squadLimits.maxPlayers} players per team · {sportConfig.name}
              </p>
            </div>
            <button onClick={onBack} className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1">
              ← Back
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {teams.map((team, index) => {
              const squad = Array.isArray(team.squad) ? team.squad : [];
              const isExpanded = expandedTeamId === team.id;
              return (
                <div key={team.id} className="border-2 border-gray-200 rounded-2xl p-4 md:p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className="text-3xl bg-gray-50 rounded-xl p-3 cursor-pointer"
                      onClick={() => {
                        const emojis = ['🏏', '🔥', '⚡', '🌟', '💎', '🎯', '🚀', '👑', '🏆', '⭐'];
                        const currentIndex = emojis.indexOf(team.emoji);
                        updateTeam(index, (entry) => ({
                          ...entry,
                          emoji: emojis[(currentIndex + 1) % emojis.length],
                        }));
                      }}
                    >
                      {team.emoji}
                    </div>
                    <div className="flex-1">
                      <AutocompleteInput
                        value={team.name}
                        onChange={(value) => updateTeam(index, (entry) => ({ ...entry, name: value }))}
                        placeholder="Team Name"
                        playerDatabase={getTeamNameSuggestions(index)}
                        className="font-semibold"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-sm font-semibold text-blue-700"
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                    >
                      {isExpanded ? 'Collapse' : 'Edit squad'}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mb-2">
                    {listSquadPlayerNames(team).length} / {squadLimits.maxPlayers} players
                    {listSquadPlayerNames(team).length < squadLimits.minPlayers
                      ? ` · need at least ${squadLimits.minPlayers}`
                      : ''}
                  </p>

                  {isExpanded && (
                    <div className="space-y-2 mt-3">
                      {squad.map((player, playerIndex) => (
                        <div key={player.id || `${team.id}-${playerIndex}`} className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 w-16">
                            {player.role === 'captain' ? 'Captain' : `P${playerIndex + 1}`}
                          </span>
                          <div className="flex-1">
                            <AutocompleteInput
                              value={player.name}
                              onChange={(value) => updateTeam(index, (entry) => {
                                const nextSquad = [...(entry.squad || [])];
                                nextSquad[playerIndex] = { ...nextSquad[playerIndex], name: value };
                                return { ...entry, squad: nextSquad };
                              })}
                              placeholder="Player name"
                              playerDatabase={getPlayerSuggestions(index, playerIndex)}
                            />
                          </div>
                          <button
                            type="button"
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                            disabled={squad.length <= squadLimits.minPlayers}
                            onClick={() => removePlayer(index, playerIndex)}
                            aria-label="Remove player"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 mt-2"
                        disabled={squad.length >= squadLimits.maxPlayers}
                        onClick={() => addPlayer(index)}
                      >
                        <Plus size={14} /> Add player
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => onGenerate({})}
              disabled={!canGenerate}
              className="btn-brand w-full py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar size={20} />
              {generatePending ? 'Generating...' : 'Generate Tournament'}
            </button>
            <button
              type="button"
              onClick={() => onSchedule({ scheduledAt: null })}
              disabled={!canGenerate || schedulePending}
              className="w-full py-4 rounded-xl bg-slate-800 text-white font-semibold text-lg hover:bg-slate-900 hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schedulePending ? 'Scheduling...' : 'Schedule Match'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEntrySquad;
