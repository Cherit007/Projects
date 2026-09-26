import React, { useMemo, useState } from 'react';
import SeedSpinWheel from './SeedSpinWheel';
import { getOrdinalLabel } from '../../utils/iplPlayoffs';

const PlayoffSeedingPanel = ({
  teams = [],
  onConfirm,
  onCancel,
  confirmLabel = 'Start Playoffs',
  pending = false,
}) => {
  const [mode, setMode] = useState('spin'); // spin | manual
  const [seedByTeamId, setSeedByTeamId] = useState({});
  const [activeTeamId, setActiveTeamId] = useState(() => String(teams[0]?.id ?? ''));
  const [error, setError] = useState('');

  const assignedSeeds = useMemo(
    () => new Set(
      Object.values(seedByTeamId)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    ),
    [seedByTeamId]
  );

  const remainingSeeds = useMemo(() => {
    const all = Array.from({ length: teams.length }, (_, index) => index + 1);
    return all.filter((seed) => !assignedSeeds.has(seed));
  }, [assignedSeeds, teams.length]);

  const unassignedTeams = useMemo(
    () => teams.filter((team) => !seedByTeamId[String(team.id)]),
    [teams, seedByTeamId]
  );

  const wheelSegments = useMemo(
    () => remainingSeeds.map((seed) => ({
      value: seed,
      label: getOrdinalLabel(seed),
    })),
    [remainingSeeds]
  );

  const activeTeam = teams.find((team) => String(team.id) === String(activeTeamId)) || unassignedTeams[0] || null;

  const assignSeed = (teamId, seed) => {
    setSeedByTeamId((prev) => {
      const next = { ...prev };
      // Clear any other team that already holds this seed (manual edits).
      Object.keys(next).forEach((key) => {
        if (Number(next[key]) === Number(seed) && key !== String(teamId)) {
          delete next[key];
        }
      });
      next[String(teamId)] = Number(seed);

      const assigned = new Set(Object.values(next).map(Number));
      const stillUnassigned = teams.filter((team) => !next[String(team.id)]);
      const stillRemaining = Array.from({ length: teams.length }, (_, index) => index + 1)
        .filter((value) => !assigned.has(value));

      // When only one team and one seed remain, auto-assign.
      if (stillUnassigned.length === 1 && stillRemaining.length === 1) {
        next[String(stillUnassigned[0].id)] = stillRemaining[0];
      }
      return next;
    });
    setError('');
  };

  const handleSpinComplete = (segment) => {
    if (!activeTeam || !segment) return;
    const teamId = String(activeTeam.id);
    const seed = Number(segment.value);

    const next = { ...seedByTeamId };
    Object.keys(next).forEach((key) => {
      if (Number(next[key]) === seed && key !== teamId) {
        delete next[key];
      }
    });
    next[teamId] = seed;

    const assigned = new Set(Object.values(next).map(Number));
    const stillUnassigned = teams.filter((team) => !next[String(team.id)]);
    const stillRemaining = Array.from({ length: teams.length }, (_, index) => index + 1)
      .filter((value) => !assigned.has(value));

    if (stillUnassigned.length === 1 && stillRemaining.length === 1) {
      next[String(stillUnassigned[0].id)] = stillRemaining[0];
    }

    setSeedByTeamId(next);

    const remainingUnassigned = teams.filter((team) => !next[String(team.id)]);
    if (remainingUnassigned.length > 0) {
      setActiveTeamId(String(remainingUnassigned[0].id));
    }
    setError('');
  };

  const allSeeded = teams.length > 0 && teams.every((team) => Number(seedByTeamId[String(team.id)]) > 0);
  const uniqueSeeds = new Set(teams.map((team) => Number(seedByTeamId[String(team.id)])));
  const seedsValid = allSeeded && uniqueSeeds.size === teams.length;

  const handleConfirm = () => {
    if (!seedsValid) {
      setError('Assign a unique position to every team before continuing.');
      return;
    }
    const ordered = [...teams].sort(
      (left, right) => Number(seedByTeamId[String(left.id)]) - Number(seedByTeamId[String(right.id)])
    );
    onConfirm?.(ordered, seedByTeamId);
  };

  return (
    <div className="playoff-seeding-panel">
      <div className="playoff-seeding-header">
        <p className="playoff-seeding-kicker">Playoff seeding</p>
        <h3 className="playoff-seeding-title">Decide 1st → {getOrdinalLabel(teams.length)}</h3>
        <p className="playoff-seeding-copy">
          Choose spin wheel or manual positions. The last remaining team gets the last spot automatically.
        </p>
      </div>

      <div className="playoff-seeding-mode" role="tablist" aria-label="Seeding mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'spin'}
          className={`playoff-seeding-mode-btn ${mode === 'spin' ? 'is-active' : ''}`}
          onClick={() => setMode('spin')}
        >
          Spin wheel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`playoff-seeding-mode-btn ${mode === 'manual' ? 'is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>

      <div className="playoff-seeding-board">
        {teams.map((team) => {
          const seed = seedByTeamId[String(team.id)];
          const isActive = mode === 'spin' && String(activeTeam?.id) === String(team.id) && !seed;
          return (
            <button
              key={team.id}
              type="button"
              className={`playoff-seed-chip ${seed ? 'is-seeded' : ''} ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (mode === 'spin' && !seed) setActiveTeamId(String(team.id));
              }}
              disabled={mode !== 'spin' || Boolean(seed)}
            >
              <span className="playoff-seed-chip-name">{team.emoji || '🏸'} {team.name || `Team ${team.id}`}</span>
              <span className="playoff-seed-chip-pos">
                {seed ? getOrdinalLabel(seed) : (isActive ? 'Spinning…' : 'Waiting')}
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'spin' ? (
        <div className="playoff-seeding-spin-wrap">
          {remainingSeeds.length <= 1 || unassignedTeams.length <= 1 ? (
            <p className="playoff-seeding-complete">
              {seedsValid
                ? 'All positions assigned.'
                : 'Last team receives the final position automatically.'}
            </p>
          ) : (
            <>
              <label className="playoff-seeding-select-label">
                Team to spin
                <select
                  value={String(activeTeam?.id || '')}
                  onChange={(event) => setActiveTeamId(event.target.value)}
                  className="playoff-seeding-select"
                >
                  {unassignedTeams.map((team) => (
                    <option key={team.id} value={String(team.id)}>
                      {team.name || `Team ${team.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <SeedSpinWheel
                key={`wheel-${remainingSeeds.join('-')}-${activeTeam?.id || 'none'}`}
                segments={wheelSegments}
                teamLabel={activeTeam?.name || 'Team'}
                disabled={!activeTeam || remainingSeeds.length <= 1}
                onSpinComplete={handleSpinComplete}
              />
            </>
          )}
        </div>
      ) : (
        <div className="playoff-seeding-manual">
          {teams.map((team) => (
            <label key={team.id} className="playoff-seeding-manual-row">
              <span>{team.emoji || '🏸'} {team.name || `Team ${team.id}`}</span>
              <select
                value={seedByTeamId[String(team.id)] || ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!value) {
                    setSeedByTeamId((prev) => {
                      const next = { ...prev };
                      delete next[String(team.id)];
                      return next;
                    });
                    return;
                  }
                  assignSeed(team.id, value);
                }}
                className="playoff-seeding-select"
              >
                <option value="">Position…</option>
                {Array.from({ length: teams.length }, (_, index) => index + 1).map((seed) => (
                  <option
                    key={seed}
                    value={seed}
                    disabled={assignedSeeds.has(seed) && Number(seedByTeamId[String(team.id)]) !== seed}
                  >
                    {getOrdinalLabel(seed)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {error && <p className="playoff-seeding-error">{error}</p>}

      <div className="playoff-seeding-actions">
        <button type="button" className="playoff-seeding-secondary" onClick={onCancel} disabled={pending}>
          Back
        </button>
        <button
          type="button"
          className="playoff-seeding-primary"
          onClick={handleConfirm}
          disabled={!seedsValid || pending}
        >
          {pending ? 'Starting…' : confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default PlayoffSeedingPanel;
