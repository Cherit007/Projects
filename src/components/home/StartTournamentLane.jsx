import React from 'react';
import { Users } from 'lucide-react';

const gameModeOptions = [
  { value: 'doubles', label: '🏸 Doubles', description: '2 players per team' },
  { value: 'singles', label: '👤 Singles', description: '1 player per team' },
  { value: 'mixed', label: '⚡ Mixed', description: 'Mixed doubles setup' },
];

const tournamentFormatOptions = [
  { value: 'league', label: '🏁 League + Final' },
  { value: 'knockoutByes', label: '🏆 Knockout + Byes' },
  { value: 'semiFinal', label: '🎯 Semi Final + Final' },
  { value: 'fullKnockout', label: '⚔️ Full Knockout' },
];

const formatHints = {
  league: 'Round-robin, top 2 advance to final',
  knockoutByes: '3+ teams: knockout bracket with automatic byes',
  semiFinal: '4 teams: 2 semi finals lead to 1 final',
  fullKnockout: '8 teams: quarter finals, semis, then final',
};

const matchesPerPairOptions = [
  { value: '1', label: '1 Match' },
  { value: '2', label: '2 Matches' },
];

const SelectionGrid = ({
  legend,
  options,
  value,
  onChange,
  columns = 2,
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">{legend}</label>
    <div
      className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      role="radiogroup"
      aria-label={legend}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`setup-selection-btn ${selected ? 'is-selected' : ''}`}
          >
            <span>{option.label}</span>
            {option.description && (
              <span className="setup-selection-copy">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

const StartTournamentLane = ({
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  format,
  setFormat,
  numTeamsInput,
  setNumTeamsInput,
  setNumTeams,
  tournamentName,
  setTournamentName,
  onNext,
  startTournamentPending = false,
}) => (
  <section className="setup-home-lane setup-home-lane-start theme-card app-surface-card app-card-tier-secondary rounded-2xl p-4 sm:p-5">
    <div className="mb-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Start Tournament</p>
      <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">Create New Tournament</h2>
      <p className="text-xs text-slate-500 mt-1">Primary setup flow for full tournament play.</p>
    </div>

    <div className="space-y-4">
      <SelectionGrid
        legend="Game Mode"
        value={gameMode}
        onChange={setGameMode}
        options={gameModeOptions}
        columns={3}
      />

      <div>
        <SelectionGrid
          legend="Tournament Format"
          value={tournamentFormat}
          onChange={(nextFormat) => {
            setTournamentFormat(nextFormat);
            if (nextFormat === 'knockoutByes' || nextFormat === 'semiFinal') {
              setNumTeams(4);
              setNumTeamsInput('4');
            } else if (nextFormat === 'fullKnockout') {
              setNumTeams(8);
              setNumTeamsInput('8');
            } else {
              setNumTeams(3);
              setNumTeamsInput('3');
            }
          }}
          options={tournamentFormatOptions}
        />
        {tournamentFormat === 'league' && (
          <div className="mt-3">
            <SelectionGrid
              legend="Matches per Pair"
              value={format}
              onChange={setFormat}
              options={matchesPerPairOptions}
            />
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">{formatHints[tournamentFormat] || formatHints.league}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
        <input
          type="text"
          value={tournamentName}
          onChange={(event) => setTournamentName(event.target.value)}
          placeholder="e.g., Summer Smash 2024"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Teams</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={numTeamsInput}
          disabled={tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes'}
          onChange={(event) => setNumTeamsInput(event.target.value.replace(/\D/g, ''))}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          {tournamentFormat === 'league' && 'Min: 3, Max: 12 teams'}
          {tournamentFormat === 'knockoutByes' && 'Min: 3, Max: 16 teams'}
          {tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes' && 'Fixed for this format'}
        </p>
      </div>

      <button
        onClick={() => onNext(numTeamsInput)}
        disabled={!tournamentName.trim() || startTournamentPending}
        className={`btn-brand action-feedback-btn ${
          startTournamentPending ? 'is-busy' : ''
        } w-full py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50`}
      >
        <div className="flex items-center justify-center gap-2">
          <Users size={20} /> {startTournamentPending ? 'Starting...' : 'Start Tournament'}
        </div>
      </button>

      <p className="text-center text-xs text-gray-500 mt-2">
        💡 Use this lane for full tournament setup. Data exploration lives in the right lane.
      </p>
    </div>
  </section>
);

export default StartTournamentLane;
