import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Sparkles, Swords } from 'lucide-react';

const LiveNarrativePanel = ({
  prediction = null,
  upsetAlert = null,
  currentMatch = null,
}) => {
  if (!currentMatch || !prediction) return null;

  const team1Name = currentMatch?.team1?.name || 'Team 1';
  const team2Name = currentMatch?.team2?.name || 'Team 2';
  const team1Probability = Number(prediction?.team1Probability || 0.5);
  const team2Probability = Number(prediction?.team2Probability || 0.5);
  const favoriteIsTeam1 = team1Probability >= team2Probability;
  const favoriteName = favoriteIsTeam1 ? team1Name : team2Name;
  const underdogName = favoriteIsTeam1 ? team2Name : team1Name;
  const underdogProbability = favoriteIsTeam1 ? team2Probability : team1Probability;
  const formDiff = Number(prediction?.factors?.formDiff || 0);
  const headToHeadSample = Number(prediction?.h2h?.sampleSize || 0);

  const formTone = formDiff > 0 ? 'up' : formDiff < 0 ? 'down' : 'neutral';

  return (
    <div className="live-narrative-shell mt-3 rounded-xl border border-cyan-400/30 bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs sm:text-sm font-semibold text-cyan-200">Match Narrative</p>
        <span className="text-[11px] text-slate-400">Live story cards</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <article className="rounded-lg border border-slate-500/35 bg-slate-900/55 px-2.5 py-2">
          <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
            <Sparkles size={12} /> Favorite
          </p>
          <p className="mt-1 text-xs text-slate-100 font-semibold truncate">{favoriteName}</p>
          <p className="text-[11px] text-cyan-300">{(Math.max(team1Probability, team2Probability) * 100).toFixed(0)}% win chance</p>
        </article>

        <article className="rounded-lg border border-slate-500/35 bg-slate-900/55 px-2.5 py-2">
          <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
            <Swords size={12} /> Rivalry Heat
          </p>
          <p className="mt-1 text-xs text-slate-100 font-semibold">{headToHeadSample} prior meetings</p>
          <p className="text-[11px] text-slate-300 truncate">{team1Name} vs {team2Name}</p>
        </article>

        <article className="rounded-lg border border-slate-500/35 bg-slate-900/55 px-2.5 py-2">
          <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
            <AlertTriangle size={12} /> Upset Meter
          </p>
          <p className="mt-1 text-xs text-slate-100 font-semibold truncate">
            {underdogName}: {(underdogProbability * 100).toFixed(0)}%
          </p>
          <p className={`text-[11px] inline-flex items-center gap-0.5 ${
            formTone === 'up' ? 'text-emerald-300' : formTone === 'down' ? 'text-rose-300' : 'text-slate-300'
          }`}>
            {formTone === 'up' && <ArrowUpRight size={12} />}
            {formTone === 'down' && <ArrowDownRight size={12} />}
            {formTone === 'neutral' && <Minus size={12} />}
            Form swing {formDiff > 0 ? '+' : ''}{formDiff.toFixed(0)}
          </p>
        </article>
      </div>

      {upsetAlert && (
        <div className="mt-2 rounded-lg border border-rose-400/35 bg-rose-950/40 px-2.5 py-2">
          <p className="text-xs font-semibold text-rose-200">⚠️ {upsetAlert.title}</p>
          <p className="text-[11px] text-rose-100 mt-0.5">{upsetAlert.message}</p>
        </div>
      )}
    </div>
  );
};

export default LiveNarrativePanel;

