import React from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import TemplateManager from '../TemplateManager';
import SportsNarrativePanel from './SportsNarrativePanel';

const ActionButton = ({
  icon,
  title,
  subtitle,
  className,
  onClick,
  disabled = false,
}) => {
  const IconComponent = icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`setup-quick-access-btn w-full text-left rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all border ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">
          <IconComponent size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold leading-tight">{title}</p>
          <p className="text-[11px] sm:text-xs opacity-80 mt-0.5 leading-tight">{subtitle}</p>
        </div>
      </div>
    </button>
  );
};

const ExploreDataLane = ({
  completedTournamentsCount = 0,
  casualCount = 0,
  totalMatchesPlayed = 0,
  topEloPlayer = null,
  showAdvancedActions = false,
  setShowAdvancedActions = () => {},
  isMobileViewport = false,
  historyCountLabel = '0',
  casualCountLabel = '0',
  setShowHistory = () => {},
  setShowCasualHistory = () => {},
  setShowEloLeaderboard = () => {},
  setShowAllTimeStats = () => {},
  setShowPairingAnalytics = () => {},
  setShowPowerRankings = () => {},
  tournamentTemplates = [],
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  canDeleteActions = false,
  gameMode = 'doubles',
  tournamentFormat = 'league',
  format = '1',
  numTeams = 3,
  playerDatabase = [],
  teamNameDatabase = [],
  narratives = {},
  sportId = 'badminton',
  hideEloFeatures = false,
}) => (
  <section className="setup-home-lane setup-home-lane-explore theme-card app-surface-card app-card-tier-secondary rounded-2xl p-4 sm:p-5">
    <div className="mb-4">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Explore Data</p>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">Insights + History</h2>
      </div>
    </div>

    <div className="mb-4">
      <TemplateManager
        templates={tournamentTemplates}
        currentConfig={{ gameMode, tournamentFormat, format, numTeams }}
        playerSuggestions={playerDatabase}
        teamNameSuggestions={teamNameDatabase}
        onSave={onSaveTemplate}
        onApply={onApplyTemplate}
        onDelete={onDeleteTemplate}
        canDelete={canDeleteActions}
      />
    </div>

    <div className="mb-4 setup-dashboard-shell">
      <p className="text-sm font-semibold text-gray-700 setup-dashboard-title mb-2">Home Dashboard</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="setup-dashboard-card app-surface-card app-card-tier-tertiary">
          <div className="setup-dashboard-icon">
            <History size={15} />
          </div>
          <p className="setup-dashboard-value">{completedTournamentsCount}</p>
          <p className="setup-dashboard-label">Completed Tournaments</p>
        </div>
        <div className="setup-dashboard-card app-surface-card app-card-tier-tertiary">
          <div className="setup-dashboard-icon">
            <Calendar size={15} />
          </div>
          <p className="setup-dashboard-value">{casualCount}</p>
          <p className="setup-dashboard-label">Casual Matches</p>
        </div>
        <div className="setup-dashboard-card app-surface-card app-card-tier-tertiary">
          <div className="setup-dashboard-icon">
            <TrendingUp size={15} />
          </div>
          <p className="setup-dashboard-value">{totalMatchesPlayed}</p>
          <p className="setup-dashboard-label">Total Matches Played</p>
        </div>
        {!hideEloFeatures && (
        <div className="setup-dashboard-card app-surface-card app-card-tier-tertiary">
          <div className="setup-dashboard-icon">
            <Trophy size={15} />
          </div>
          <p className="setup-dashboard-value">{topEloPlayer ? topEloPlayer.rating : '--'}</p>
          <p className="setup-dashboard-label">
            {topEloPlayer ? `${topEloPlayer.name} (Top ELO)` : 'Top ELO Pending'}
          </p>
        </div>
        )}
      </div>
    </div>

    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700 setup-quick-access-title">Quick Access</p>
        <button
          type="button"
          onClick={() => setShowAdvancedActions((prev) => !prev)}
          className="setup-advanced-toggle text-xs font-semibold flex items-center gap-1"
        >
          {showAdvancedActions ? 'Hide advanced' : 'Show advanced'}
          {showAdvancedActions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
        {!isMobileViewport && (
          <ActionButton
            icon={History}
            title={`History (${historyCountLabel})`}
            subtitle="Tournaments and casual matches"
            className="bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
            onClick={() => setShowHistory(true)}
          />
        )}
        <ActionButton
          icon={Calendar}
          title={`Casual Matches (${casualCountLabel})`}
          subtitle="Quick access to casual records"
          className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100"
          onClick={() => setShowHistory(true)}
        />
        {hideEloFeatures && (
          <ActionButton
            icon={TrendingUp}
            title="All-Time Stats"
            subtitle="Career runs, wickets and wins"
            className="bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100"
            onClick={() => setShowAllTimeStats(true)}
          />
        )}
        {!hideEloFeatures && (
        <ActionButton
          icon={Trophy}
          title="ELO Leaderboard"
          subtitle="Current rating rankings"
          className="bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100"
          onClick={() => setShowEloLeaderboard(true)}
        />
        )}
      </div>

      {showAdvancedActions && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-600 mb-2">Advanced Tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ActionButton
              icon={TrendingUp}
              title="All-Time Stats"
              subtitle={hideEloFeatures ? 'Career runs, wickets and wins' : 'Career summary across tournaments'}
              className="bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100"
              onClick={() => setShowAllTimeStats(true)}
            />
            {!hideEloFeatures && (
            <ActionButton
              icon={Sparkles}
              title="Pairing Analytics"
              subtitle="Best combinations and chemistry"
              className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
              onClick={() => setShowPairingAnalytics(true)}
            />
            )}
            {!hideEloFeatures && (
            <ActionButton
              icon={BarChart3}
              title="Power Rankings"
              subtitle="Form and momentum leaders"
              className="bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
              onClick={() => setShowPowerRankings(true)}
            />
            )}
          </div>
        </div>
      )}
    </div>

    <SportsNarrativePanel narratives={narratives} />
  </section>
);

export default ExploreDataLane;
