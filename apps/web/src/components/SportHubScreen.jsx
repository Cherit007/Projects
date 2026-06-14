import React, { useMemo } from 'react';
import { ChevronRight, Trophy, Calendar, Zap } from 'lucide-react';
import { SPORT_CATALOG } from './setup/sportSetupConfig';
import { buildAllSportHubSummaries } from '../utils/sportDataFilters';

const SportHubScreen = ({
  tournamentHistory = [],
  casualMatches = [],
  activeLiveTournaments = [],
  scheduledTournaments = [],
  activeCasualDraft = null,
  onSelectSport,
  groupName = '',
}) => {
  const availableSports = useMemo(
    () => SPORT_CATALOG.filter((sport) => sport.available),
    [],
  );

  const summaries = useMemo(() => (
    buildAllSportHubSummaries({
      sports: availableSports.map((sport) => ({ id: sport.id })),
      tournamentHistory,
      casualMatches,
      activeLiveTournaments,
      scheduledTournaments,
      activeCasualDraft,
    })
  ), [activeCasualDraft, activeLiveTournaments, availableSports, casualMatches, scheduledTournaments, tournamentHistory]);

  const summaryBySport = useMemo(() => (
    Object.fromEntries(summaries.map((entry) => [entry.sportId, entry]))
  ), [summaries]);

  return (
    <div className="theme-page py-8 px-4 app-screen-home">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Sport Hub</p>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Choose a sport</h1>
          <p className="text-slate-600 max-w-2xl">
            Each sport has its own workspace — fixtures, live scoring, history, and stats stay separate
            {groupName ? ` for ${groupName}` : ''}.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableSports.map((sport) => {
            const summary = summaryBySport[sport.id] || {};
            const inProgressCount = Number(summary.inProgressCount ?? summary.liveTournaments ?? 0);
            const hasLive = inProgressCount > 0;
            return (
              <button
                key={sport.id}
                type="button"
                className="sport-hub-card text-left"
                onClick={() => onSelectSport?.(sport.id)}
              >
                <div className="sport-hub-card-head">
                  <span className="sport-hub-card-icon" aria-hidden>{sport.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="sport-hub-card-title">{sport.label}</p>
                    <p className="sport-hub-card-desc">
                      {sport.id === 'boxCricket'
                        ? 'Squads · innings · casual series'
                        : sport.id === 'pickleball'
                          ? 'Doubles · rally scoring · ELO'
                          : 'Singles & doubles · ELO rankings'}
                    </p>
                  </div>
                  <ChevronRight size={18} className="sport-hub-card-arrow" />
                </div>

                <div className="sport-hub-card-stats">
                  <span className="sport-hub-stat">
                    <Zap size={14} />
                    {inProgressCount} in progress
                  </span>
                  <span className="sport-hub-stat">
                    <Trophy size={14} />
                    {summary.completedTournaments || 0} done
                  </span>
                  <span className="sport-hub-stat">
                    <Calendar size={14} />
                    {summary.casualMatches || 0} casual
                  </span>
                </div>

                {hasLive && (
                  <span className="sport-hub-live-badge">In progress</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SportHubScreen;
