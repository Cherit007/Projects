import React, { useMemo } from 'react';

const formatTeam = (team) => {
  if (!team) return 'TBD';
  const p1 = team.player || team.player1 || '';
  const p2 = team.player2 || '';
  if (!p1 && !p2) return team.name || 'Team';
  return p2 ? `${team.name || 'Team'} (${p1} & ${p2})` : `${team.name || 'Team'} (${p1})`;
};

const getAllBracketMatches = (bracket = []) => {
  return (bracket || []).flat().filter(Boolean);
};

const getLiveMatchFromTournament = (tournament) => {
  if (!tournament) return null;

  const fixtureLive = (tournament.fixtures || []).find(match => match?.team1 && match?.team2 && !match?.completed);
  if (fixtureLive) return fixtureLive;

  const bracketLive = getAllBracketMatches(tournament.bracket).find(
    match => match?.team1 && match?.team2 && !match?.completed
  );
  if (bracketLive) return bracketLive;

  return null;
};

const isTournamentStarted = (tournament) => {
  if (!tournament) return false;
  const fixtureHasScheduled = (tournament.fixtures || []).some(match => match?.team1 && match?.team2);
  const bracketHasScheduled = getAllBracketMatches(tournament.bracket).some(match => match?.team1 && match?.team2);
  const finalHasScheduled = Boolean(tournament.finalMatch?.team1 && tournament.finalMatch?.team2);
  return fixtureHasScheduled || bracketHasScheduled || finalHasScheduled;
};

const findCurrentLive = ({ step, champion, tournamentFormat, fixtures, bracket, tournamentName, history }) => {
  if (step === 'tournament' && !champion) {
    const inMemoryMatch = tournamentFormat === 'league'
      ? (fixtures || []).find(match => !match?.completed)
      : getAllBracketMatches(bracket).find(match => match?.team1 && match?.team2 && !match?.completed);

    if (inMemoryMatch) {
      return {
        match: inMemoryMatch,
        sourceTournament: { name: tournamentName || 'Current Tournament' },
      };
    }
  }

  const activeTournament = (history || []).find(
    tournament => tournament?.status === 'active' && isTournamentStarted(tournament)
  );
  if (!activeTournament) return null;

  const live = getLiveMatchFromTournament(activeTournament);
  if (!live) return null;

  return {
    match: live,
    sourceTournament: activeTournament,
  };
};

const ViewerDashboard = ({
  group,
  tournamentName,
  tournamentFormat,
  step,
  champion,
  fixtures,
  bracket,
  tournamentHistory,
  allTimeStats,
  eloLeaderboard,
}) => {
  const liveState = useMemo(() => findCurrentLive({
    step,
    champion,
    tournamentFormat,
    fixtures,
    bracket,
    tournamentName,
    history: tournamentHistory,
  }), [step, champion, tournamentFormat, fixtures, bracket, tournamentName, tournamentHistory]);

  const statsRows = useMemo(() => {
    if (Array.isArray(allTimeStats) && allTimeStats.length > 0) {
      return allTimeStats.slice(0, 10).map((player) => ({
        key: player.name,
        name: player.name,
        subtitle: `W ${player.matchesWon || 0} / P ${player.matchesPlayed || 0}`,
      }));
    }

    if (Array.isArray(eloLeaderboard) && eloLeaderboard.length > 0) {
      return eloLeaderboard.slice(0, 10).map((player) => ({
        key: player.name,
        name: player.name,
        subtitle: `ELO ${player.rating}`,
      }));
    }

    return [];
  }, [allTimeStats, eloLeaderboard]);

  return (
    <div className="theme-page viewer-dashboard-page min-h-screen p-4 sm:p-6">
      <div className="max-w-6xl mx-auto grid gap-4 sm:gap-5">
        <section className="theme-card viewer-dashboard-hero rounded-3xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest text-slate-500">Read Only</p>
          <h1 className="theme-title text-2xl sm:text-4xl font-bold mt-1">{group?.name || 'Group'} Viewer</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2">Live status, history, rankings, and performance stats.</p>
        </section>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
          <section className="theme-card viewer-dashboard-card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Current Live Match</h2>
            {liveState?.match ? (
              <div className="mt-3 space-y-2">
                <p className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 viewer-live-badge">
                  LIVE • {liveState.sourceTournament?.name || 'Tournament'}
                </p>
                <p className="text-slate-900 font-semibold">{formatTeam(liveState.match.team1)} vs {formatTeam(liveState.match.team2)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No live tournament right now.</p>
            )}
          </section>

          <section className="theme-card viewer-dashboard-card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Top Rankings</h2>
            {eloLeaderboard?.length ? (
              <div className="mt-3 grid gap-2">
                {eloLeaderboard.slice(0, 8).map((player, index) => (
                  <div key={player.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 viewer-dashboard-row">
                    <p className="text-sm text-slate-800">#{index + 1} {player.name}</p>
                    <p className="text-sm font-semibold text-slate-900">{player.rating}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No ranking data available.</p>
            )}
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
          <section className="theme-card viewer-dashboard-card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Tournament History</h2>
            {tournamentHistory?.length ? (
              <div className="mt-3 grid gap-2 max-h-[340px] overflow-auto pr-1">
                {tournamentHistory.slice(0, 12).map((tournament) => (
                  <div key={tournament.id || tournament.appwriteId} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 viewer-dashboard-row">
                    <p className="font-semibold text-slate-900">{tournament.name}</p>
                    <p className="text-xs text-slate-600">{tournament.date} • {tournament.teams?.length || 0} teams</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No tournament history yet.</p>
            )}
          </section>

          <section className="theme-card viewer-dashboard-card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Player Stats</h2>
            {statsRows.length ? (
              <div className="mt-3 grid gap-2 max-h-[340px] overflow-auto pr-1">
                {statsRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 viewer-dashboard-row">
                    <p className="text-sm font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-600">{row.subtitle}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No stats available yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ViewerDashboard;
