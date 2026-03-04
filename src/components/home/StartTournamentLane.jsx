import React from 'react';
import { Users } from 'lucide-react';

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
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Game Mode</label>
        <select
          value={gameMode}
          onChange={(event) => setGameMode(event.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white"
        >
          <option value="doubles">🏸 Doubles (2 players per team)</option>
          <option value="singles">👤 Singles (1 player per team)</option>
          <option value="mixed">⚡ Mixed Doubles</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Format</label>
        <select
          value={tournamentFormat}
          onChange={(event) => {
            const nextFormat = event.target.value;
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
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white"
        >
          <option value="league">📊 League + Final</option>
          <option value="knockoutByes">🏆 Knockout + Byes (3+ teams)</option>
          <option value="semiFinal">🏆 Semi Final + Final (4 teams)</option>
          <option value="fullKnockout">⚔️ Full Knockout (8 teams)</option>
        </select>
        {tournamentFormat === 'league' && (
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white mt-2"
          >
            <option value="1">1 match per pair</option>
            <option value="2">2 matches per pair</option>
          </select>
        )}
        <p className="text-xs text-gray-500 mt-2">
          {tournamentFormat === 'knockoutByes' && '3+ teams: knockout bracket with automatic byes'}
          {tournamentFormat === 'semiFinal' && '4 teams: 2 semi finals → 1 final'}
          {tournamentFormat === 'fullKnockout' && '8 teams: quarters → semis → final'}
          {tournamentFormat === 'league' && 'Round-robin, top 2 advance to final'}
        </p>
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

