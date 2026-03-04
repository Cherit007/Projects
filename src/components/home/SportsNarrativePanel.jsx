import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Minus,
  Swords,
  TrendingUp,
} from 'lucide-react';

const SportsNarrativePanel = ({ narratives = {} }) => {
  const streakLeaders = Array.isArray(narratives?.streakLeaders) ? narratives.streakLeaders : [];
  const rivalries = Array.isArray(narratives?.rivalries) ? narratives.rivalries : [];
  const formWatch = Array.isArray(narratives?.formWatch) ? narratives.formWatch : [];
  const upsetWatch = Array.isArray(narratives?.upsetWatch) ? narratives.upsetWatch : [];

  return (
    <section className="setup-narrative-shell rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-xs sm:text-sm font-semibold text-slate-700 setup-narrative-heading">Sports Narrative</p>
        <span className="text-[11px] text-slate-500 setup-narrative-subtitle">Live context + momentum</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <article className="rounded-lg border border-rose-200 bg-white/90 p-2.5 setup-narrative-card setup-narrative-card-streak">
          <p className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
            <Flame size={12} /> Streak Leaders
          </p>
          {streakLeaders.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-500 setup-narrative-empty">Play more matches to reveal streaks.</p>
          ) : (
            <div className="mt-1.5 space-y-1">
              {streakLeaders.map((entry) => (
                <div key={`streak-${entry.name}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-700 setup-narrative-item-label">{entry.name}</span>
                  <span className={`font-bold ${entry.type === 'win' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {entry.count} {entry.type === 'win' ? 'W' : 'L'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-indigo-200 bg-white/90 p-2.5 setup-narrative-card setup-narrative-card-rivalry">
          <p className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1.5">
            <Swords size={12} /> Rivalries Of The Week
          </p>
          {rivalries.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-500 setup-narrative-empty">No repeated head-to-head yet.</p>
          ) : (
            <div className="mt-1.5 space-y-1">
              {rivalries.map((entry) => (
                <div key={`rivalry-${entry.teamA}-${entry.teamB}`} className="text-xs">
                  <p className="text-slate-700 truncate setup-narrative-item-label">{entry.teamA} vs {entry.teamB}</p>
                  <p className="text-indigo-600 font-semibold setup-narrative-item-value">{entry.games} meetings</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-cyan-200 bg-white/90 p-2.5 setup-narrative-card setup-narrative-card-form">
          <p className="text-[11px] font-semibold text-cyan-700 flex items-center gap-1.5">
            <TrendingUp size={12} /> Form Arrows
          </p>
          {formWatch.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-500 setup-narrative-empty">Form data appears after ELO updates.</p>
          ) : (
            <div className="mt-1.5 space-y-1">
              {formWatch.map((entry) => (
                <div key={`form-${entry.name}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-700 setup-narrative-item-label">{entry.name}</span>
                  <span className={`inline-flex items-center gap-0.5 font-bold ${
                    entry.tone === 'up'
                      ? 'text-emerald-700'
                      : entry.tone === 'down'
                        ? 'text-rose-700'
                        : 'text-slate-600'
                  }`}>
                    {entry.tone === 'up' && <ArrowUpRight size={12} />}
                    {entry.tone === 'down' && <ArrowDownRight size={12} />}
                    {entry.tone === 'neutral' && <Minus size={12} />}
                    {entry.delta > 0 ? '+' : ''}{entry.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-amber-200 bg-white/90 p-2.5 setup-narrative-card setup-narrative-card-upset">
          <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Upset Watch
          </p>
          {upsetWatch.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-500 setup-narrative-empty">No high-risk upsets detected now.</p>
          ) : (
            <div className="mt-1.5 space-y-1">
              {upsetWatch.map((entry) => (
                <div key={`upset-${entry.matchup}`} className="text-xs">
                  <p className="truncate text-slate-700 setup-narrative-item-label">{entry.matchup}</p>
                  <p className="font-semibold text-amber-700 setup-narrative-item-value">
                    {entry.underdog} at {(entry.underdogProbability * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

export default SportsNarrativePanel;
