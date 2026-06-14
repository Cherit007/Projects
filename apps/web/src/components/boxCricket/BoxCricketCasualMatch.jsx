import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, Plus, Trash2, ChevronRight } from 'lucide-react';
import AutocompleteInput from '../AutocompleteInput';
import { getSport } from '@fixture-maker/domain/sports';
import {
  CASUAL_SERIES_FORMATS,
  buildCasualSeriesStatistics,
  getCasualSeriesConfig,
  isCasualSeriesComplete,
} from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import {
  createEmptySquadTeam,
  createSquadPlayer,
  filterAutocompleteSuggestions,
  getSquadLimits,
  getUsedSquadNames,
  getUsedTeamNames,
  isSquadTeamValid,
  listSquadPlayerNames,
  setSquadCaptain,
  syncLegacyPlayersFromSquad,
} from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import BoxCricketScorer from './BoxCricketScorer';
import BoxCricketScoringModePanel from './BoxCricketScoringModePanel';
import BoxCricketTossPanel from './BoxCricketTossPanel';
import CasualMatchShell from '../setup/CasualMatchShell';
import { isTossComplete } from '@fixture-maker/domain/sports/boxCricket/matchSetup';
import { createBoxCricketCasualDraft } from '../../utils/boxCricketCasualDraft';

const MIN_OVERS = 1;
const MAX_OVERS = 30;

const clampOversLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.min(MAX_OVERS, Math.max(MIN_OVERS, Math.round(parsed)));
};

const BoxCricketCasualMatch = ({
  playerDatabase = [],
  teamNameDatabase = [],
  ruleConfig = {},
  onSaveMatch,
  onAddPlayer = () => {},
  onClose,
  onChangeSport,
  layout = 'modal',
  initialDraft = null,
  onDraftChange = null,
  onDraftClear = null,
}) => {
  const sportConfig = useMemo(() => getSport('boxCricket'), []);
  const squadLimits = useMemo(() => getSquadLimits(sportConfig), [sportConfig]);
  const [step, setStep] = useState(initialDraft?.step || 'teams');
  const [toss, setToss] = useState(initialDraft?.toss || { tossWinnerTeamId: null, electedTo: null });
  const [scoringMode, setScoringMode] = useState(initialDraft?.scoringMode || 'summary');
  const [seriesFormat, setSeriesFormat] = useState(initialDraft?.seriesFormat || 'single');
  const [teams, setTeams] = useState(() => (
    initialDraft?.teams?.length === 2
      ? initialDraft.teams
      : [createEmptySquadTeam(1, sportConfig), createEmptySquadTeam(2, sportConfig)]
  ));
  const [expandedTeamId, setExpandedTeamId] = useState(teams[0]?.id || 1);
  const [saving, setSaving] = useState(false);
  const [seriesGames, setSeriesGames] = useState(initialDraft?.seriesGames || []);
  const [team1Wins, setTeam1Wins] = useState(initialDraft?.team1Wins || 0);
  const [team2Wins, setTeam2Wins] = useState(initialDraft?.team2Wins || 0);
  const [gameNumber, setGameNumber] = useState(initialDraft?.gameNumber || 1);
  const [scorerEpoch, setScorerEpoch] = useState(initialDraft?.scorerEpoch || 0);
  const [scorerSnapshot, setScorerSnapshot] = useState(initialDraft?.scorer || null);
  const [matchRuleConfig, setMatchRuleConfig] = useState(() => ({
    oversLimit: clampOversLimit(
      initialDraft?.ruleConfig?.oversLimit
      ?? ruleConfig?.oversLimit
      ?? sportConfig.defaultRuleConfig?.oversLimit
      ?? 6,
    ),
  }));
  const [oversInput, setOversInput] = useState(() => String(
    clampOversLimit(
      initialDraft?.ruleConfig?.oversLimit
      ?? ruleConfig?.oversLimit
      ?? sportConfig.defaultRuleConfig?.oversLimit
      ?? 6,
    ),
  ));
  const oversLimitRef = useRef(matchRuleConfig.oversLimit);

  useEffect(() => {
    if (oversLimitRef.current === matchRuleConfig.oversLimit) return;
    oversLimitRef.current = matchRuleConfig.oversLimit;
    setScorerSnapshot(null);
    setScorerEpoch((value) => value + 1);
  }, [matchRuleConfig.oversLimit]);

  const resolvedRuleConfig = useMemo(() => ({
    ...(sportConfig.defaultRuleConfig || {}),
    ...(ruleConfig || {}),
    ...matchRuleConfig,
  }), [sportConfig, ruleConfig, matchRuleConfig]);

  const seriesConfig = useMemo(() => getCasualSeriesConfig(seriesFormat), [seriesFormat]);

  const updateTeam = (index, updater) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = syncLegacyPlayersFromSquad(updater({ ...next[index] }));
      return next;
    });
  };

  const getTeamNameSuggestions = (teamIndex) => (
    filterAutocompleteSuggestions(
      teamNameDatabase,
      getUsedTeamNames(teams, teamIndex),
      teams[teamIndex]?.name,
    )
  );

  const getPlayerSuggestions = (teamIndex, playerIndex) => {
    const usedNames = getUsedSquadNames(teams, { teamIndex, playerIndex });
    return filterAutocompleteSuggestions(
      playerDatabase,
      usedNames,
      teams[teamIndex]?.squad?.[playerIndex]?.name,
    );
  };

  const setCaptain = (teamIndex, playerId) => {
    updateTeam(teamIndex, (team) => ({
      ...team,
      squad: setSquadCaptain(team.squad || [], playerId),
    }));
  };

  const [team1, team2] = teams;
  const teamsReady = isSquadTeamValid(team1, sportConfig) && isSquadTeamValid(team2, sportConfig);
  const oversReady = matchRuleConfig.oversLimit >= MIN_OVERS && matchRuleConfig.oversLimit <= MAX_OVERS;
  const canContinueToToss = teamsReady && oversReady;

  const handleOversInputChange = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    setOversInput(digits);
    if (digits) {
      setMatchRuleConfig((prev) => ({ ...prev, oversLimit: clampOversLimit(digits) }));
    }
  };

  const handleOversInputBlur = () => {
    const next = clampOversLimit(oversInput || matchRuleConfig.oversLimit || 6);
    setOversInput(String(next));
    setMatchRuleConfig((prev) => ({ ...prev, oversLimit: next }));
  };

  const buildDraft = useCallback(() => createBoxCricketCasualDraft({
    id: initialDraft?.id,
    step,
    teams,
    toss,
    scoringMode,
    seriesFormat,
    ruleConfig: matchRuleConfig,
    seriesGames,
    team1Wins,
    team2Wins,
    gameNumber,
    scorerEpoch,
    scorer: scorerSnapshot,
  }), [
    initialDraft?.id,
    step,
    teams,
    toss,
    scoringMode,
    seriesFormat,
    matchRuleConfig,
    seriesGames,
    team1Wins,
    team2Wins,
    gameNumber,
    scorerEpoch,
    scorerSnapshot,
  ]);

  useEffect(() => {
    if (typeof onDraftChange !== 'function') return undefined;
    const timer = window.setTimeout(() => {
      onDraftChange(buildDraft());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [buildDraft, onDraftChange]);

  const registerPlayers = () => {
    [team1, team2].forEach((team) => {
      listSquadPlayerNames(team).forEach((name) => onAddPlayer(name));
    });
  };

  const persistSeries = async (allGames, t1Wins, t2Wins, { keepOpen = false } = {}) => {
    registerPlayers();
    const syncedTeam1 = syncLegacyPlayersFromSquad(team1);
    const syncedTeam2 = syncLegacyPlayersFromSquad(team2);
    const lastGame = allGames[allGames.length - 1];
    const isSingle = seriesFormat === 'single';
    const saveResult = await onSaveMatch({
      type: 'casual',
      sportId: 'boxCricket',
      matchType: 'team',
      seriesFormat,
      date: new Date().toISOString(),
      team1: syncedTeam1,
      team2: syncedTeam2,
      score1: isSingle ? lastGame.score1 : t1Wins,
      score2: isSingle ? lastGame.score2 : t2Wins,
      statistics: buildCasualSeriesStatistics({
        team1: syncedTeam1,
        team2: syncedTeam2,
        seriesFormat,
        games: allGames,
        team1Wins: t1Wins,
        team2Wins: t2Wins,
      }),
    }, { keepOpen });
    if (saveResult?.success === false) {
      throw new Error(saveResult.error || 'Save failed');
    }
    if (!keepOpen) {
      onDraftClear?.();
      onClose?.();
    }
  };

  const handleSaveScore = async (_matchId, score1, score2, extras = {}, options = {}) => {
    const { keepSessionOpen = false } = options;
    const syncedTeam1 = syncLegacyPlayersFromSquad(team1);
    const syncedTeam2 = syncLegacyPlayersFromSquad(team2);
    const winnerTeamId = Number(score1) > Number(score2) ? syncedTeam1.id : syncedTeam2.id;
    const gameRecord = {
      gameNo: gameNumber,
      score1: Number(score1),
      score2: Number(score2),
      winnerTeamId,
      statistics: extras.statistics,
    };

    const nextT1 = team1Wins + (winnerTeamId === syncedTeam1.id ? 1 : 0);
    const nextT2 = team2Wins + (winnerTeamId === syncedTeam2.id ? 1 : 0);
    const allGames = [...seriesGames, gameRecord];

    if (isCasualSeriesComplete(nextT1, nextT2, seriesFormat)) {
      setSaving(true);
      try {
        await persistSeries(allGames, nextT1, nextT2, { keepOpen: keepSessionOpen });
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    }

    if (keepSessionOpen) {
      setSeriesGames(allGames);
      setTeam1Wins(nextT1);
      setTeam2Wins(nextT2);
      setGameNumber((value) => value + 1);
      setScorerEpoch((value) => value + 1);
      setScorerSnapshot(null);
      return 'continue';
    }

    setSaving(true);
    try {
      await persistSeries(allGames, nextT1, nextT2, { keepOpen: false });
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = seriesFormat === 'single'
    ? 'Save match'
    : isCasualSeriesComplete(team1Wins, team2Wins, seriesFormat)
      ? 'Save series'
      : `Save game ${gameNumber} & continue`;

  const handleClose = () => {
    if (typeof onDraftChange === 'function') {
      onDraftChange(buildDraft());
    }
    onClose?.();
  };

  const handleRematch = (saveResult) => {
    if (saveResult === false || saveResult === 'continue') return;
    if (saveResult === true && seriesFormat !== 'single') {
      return;
    }
    setToss({ tossWinnerTeamId: null, electedTo: null });
    setScorerEpoch((value) => value + 1);
    setScorerSnapshot(null);
    setStep('toss');
  };

  const rematchLabel = seriesFormat === 'single'
    ? 'Start new match · same teams'
    : `Save game ${gameNumber} & start next · same teams`;

  return (
    <CasualMatchShell
      layout={layout}
      title="Box Cricket Casual Match"
      subtitle="Two teams · single game or best-of-3/5 series"
      icon={Users}
      onClose={handleClose}
      headerTone="emerald"
    >
          {onChangeSport && layout === 'modal' && (
            <button
              type="button"
              className="text-sm text-emerald-700 font-semibold mb-3"
              onClick={onChangeSport}
            >
              ← Change sport
            </button>
          )}
          {step === 'teams' ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Enter two teams with {squadLimits.minPlayers}+ players each, pick overs and series length.
              </p>

              <TextLabel>Overs per innings</TextLabel>
              <div className="mb-5">
                <input
                  type="number"
                  min={MIN_OVERS}
                  max={MAX_OVERS}
                  step={1}
                  inputMode="numeric"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-900"
                  value={oversInput}
                  onChange={(event) => handleOversInputChange(event.target.value)}
                  onBlur={handleOversInputBlur}
                  aria-label="Overs per innings"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter {MIN_OVERS}–{MAX_OVERS} overs for each innings.
                </p>
              </div>

              <TextLabel>Series</TextLabel>
              <div className="box-cricket-series-options mb-5">
                {Object.values(CASUAL_SERIES_FORMATS).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`box-cricket-mode-btn ${seriesFormat === option.id ? 'is-active' : ''}`}
                    onClick={() => setSeriesFormat(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-4">
                {teams.map((team, index) => {
                  const squad = Array.isArray(team.squad) ? team.squad : [];
                  const isExpanded = expandedTeamId === team.id;
                  return (
                    <div key={team.id} className="border-2 border-gray-200 rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{team.emoji}</span>
                        <div className="flex-1">
                          <AutocompleteInput
                            value={team.name}
                            onChange={(value) => updateTeam(index, (entry) => ({ ...entry, name: value }))}
                            placeholder={`Team ${index + 1} name`}
                            playerDatabase={getTeamNameSuggestions(index)}
                            className="font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          className="text-sm font-semibold text-emerald-700"
                          onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                        >
                          {isExpanded ? 'Collapse' : 'Squad'}
                        </button>
                      </div>

                      <p className="text-xs text-gray-500">
                        {listSquadPlayerNames(team).length}/{squadLimits.maxPlayers} players
                      </p>

                      {isExpanded && (
                        <div className="space-y-2 mt-3">
                          {squad.map((player, playerIndex) => (
                            <div key={player.id || `${team.id}-${playerIndex}`} className="flex gap-2 items-center">
                              <button
                                type="button"
                                className={`box-cricket-captain-tag ${player.role === 'captain' ? 'is-captain' : ''}`}
                                onClick={() => setCaptain(index, player.id)}
                                disabled={!String(player.name || '').trim()}
                                title={player.role === 'captain' ? 'Captain' : 'Make captain'}
                              >
                                {player.role === 'captain' ? 'C' : 'C?'}
                              </button>
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
                              {squad.length > squadLimits.minPlayers ? (
                                <button
                                  type="button"
                                  className="text-red-600 p-2"
                                  onClick={() => updateTeam(index, (entry) => ({
                                    ...entry,
                                    squad: entry.squad.filter((_, slot) => slot !== playerIndex),
                                  }))}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {squad.length < squadLimits.maxPlayers && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                              onClick={() => updateTeam(index, (entry) => ({
                                ...entry,
                                squad: [...(entry.squad || []), createSquadPlayer()],
                              }))}
                            >
                              <Plus size={14} /> Add player
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canContinueToToss}
                className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => {
                  handleOversInputBlur();
                  registerPlayers();
                  setStep('toss');
                }}
              >
                Continue to toss
                <ChevronRight size={18} />
              </button>
            </>
          ) : step === 'toss' ? (
            <>
              <button
                type="button"
                className="start-match-back-link"
                onClick={() => setStep('teams')}
              >
                ← Edit teams & series
              </button>
              <p className="text-sm text-gray-600 mb-4">
                {resolvedRuleConfig.oversLimit}-over match · {seriesConfig.label}
              </p>
              <BoxCricketTossPanel
                team1={team1}
                team2={team2}
                tossWinnerTeamId={toss.tossWinnerTeamId}
                electedTo={toss.electedTo}
                onChangeTossWinner={(id) => setToss((prev) => ({ ...prev, tossWinnerTeamId: id }))}
                onChangeElectedTo={(value) => setToss((prev) => ({ ...prev, electedTo: value }))}
                onContinue={() => setStep('scoringMode')}
                continueDisabled={!isTossComplete(toss)}
              />
            </>
          ) : step === 'scoringMode' ? (
            <>
              <button
                type="button"
                className="start-match-back-link"
                onClick={() => setStep('toss')}
              >
                ← Edit toss
              </button>
              <BoxCricketScoringModePanel
                value={scoringMode}
                onChange={setScoringMode}
                onContinue={() => setStep('score')}
              />
            </>
          ) : (
            <>
              <button
                type="button"
                className="start-match-back-link"
                onClick={() => setStep('scoringMode')}
              >
                ← Change scoring mode
              </button>

              {seriesFormat !== 'single' && (
                <div className="box-cricket-series-scoreboard mb-4">
                  <p className="text-sm font-semibold text-gray-700">
                    Series · {seriesConfig.label}
                  </p>
                  <p className="text-lg font-bold text-emerald-800">
                    {team1?.name || 'Team 1'} {team1Wins} – {team2Wins} {team2?.name || 'Team 2'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Game {gameNumber} of up to {seriesConfig.maxGames} · first to {seriesConfig.winsRequired} wins
                  </p>
                </div>
              )}

              <BoxCricketScorer
                key={`casual-scorer-${scorerEpoch}-${resolvedRuleConfig.oversLimit}`}
                team1={team1}
                team2={team2}
                ruleConfig={resolvedRuleConfig}
                matchToss={toss}
                requireToss={false}
                initialScoringMode={scoringMode}
                lockScoringMode
                draftScorer={scorerSnapshot}
                onScorerSnapshotChange={setScorerSnapshot}
                onSaveScore={handleSaveScore}
                onRematch={handleRematch}
                rematchLabel={rematchLabel}
                title={seriesFormat === 'single'
                  ? 'Casual match · Box Cricket'
                  : `Casual series · Game ${gameNumber}`}
                totalMatchesCount={seriesFormat === 'single' ? 0 : seriesConfig.maxGames}
                completedMatchesCount={gameNumber - 1}
                submitLabel={submitLabel}
              />
              {saving && (
                <p className="text-sm text-gray-500 mt-2 text-center">Saving series…</p>
              )}
            </>
          )}
    </CasualMatchShell>
  );
};

const TextLabel = ({ children }) => (
  <p className="text-sm font-semibold text-gray-700 mb-2">{children}</p>
);

export default BoxCricketCasualMatch;
