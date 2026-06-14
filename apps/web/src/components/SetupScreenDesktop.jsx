import React from 'react';
import {
  Clock3,
  Play,
  PencilLine,
  MessageCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import StartTournamentLane from './home/StartTournamentLane';
import ExploreDataLane from './home/ExploreDataLane';
import {
  formatTournamentDateLabel,
  isScheduledTournamentAlreadyStarted,
} from '../utils/appHelpers';
import { getSportMeta } from './setup';

const SetupScreenDesktop = ({
  syncChip,
  scheduledCards,
  scheduledCarouselIndex,
  scrollScheduledToIndex,
  scheduledCarouselRef,
  handleScheduledTrackScroll,
  handleViewScheduledCard,
  activeLiveTournaments,
  isPendingAction,
  onEditScheduledTournament,
  onStartScheduledTournament,
  onShareScheduledTournament,
  onDeleteTournament,
  canDeleteActions,
  onResumeActiveTournament,
  onDeleteActiveTournament,
  canDeleteLiveTournament,
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
  sportId,
  setSportId,
  ruleConfig,
  setRuleConfig,
  onNext,
  startTournamentPending,
  completedTournamentsCount,
  displayCasualMatches,
  totalMatchesPlayed,
  topEloPlayer,
  showAdvancedActions,
  setShowAdvancedActions,
  isMobileViewport,
  historyCountLabel,
  casualCountLabel,
  setShowHistory,
  setShowCasualHistory,
  setShowEloLeaderboard,
  setShowAllTimeStats,
  setShowPairingAnalytics,
  setShowPowerRankings,
  tournamentTemplates,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  canDeleteActionsForExplore,
  numTeams,
  playerDatabase,
  teamNameDatabase,
  narratives,
}) => (
  <div className="theme-page py-8 px-4 app-screen-home">
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 setup-desktop-hero">
        <div className="setup-desktop-hero-icon" aria-hidden>🏆</div>
        <h1 className="theme-title app-hero-title text-4xl md:text-5xl font-bold mb-2">
          Tournament Hub
        </h1>
        <p className="text-gray-600 app-hero-subtitle">Create, manage, and score any sport</p>
      </div>

      <div className="theme-card app-surface-card app-card-tier-primary app-rhythm-panel rounded-2xl p-4 sm:p-5 md:p-6 mb-6">
        <div className="setup-home-sync-row mb-4">
          {syncChip}
        </div>

        {scheduledCards.length > 0 && (
          <div className="mb-4 rounded-xl p-4 setup-highlight-card setup-scheduled-card app-surface-card app-card-tier-secondary">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2 setup-scheduled-title">
                <Clock3 size={16} /> Scheduled Tournaments ({scheduledCards.length})
              </p>
              {scheduledCards.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous scheduled tournament"
                    onClick={() => scrollScheduledToIndex(scheduledCarouselIndex - 1)}
                    className="h-7 w-7 rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 inline-flex items-center justify-center"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next scheduled tournament"
                    onClick={() => scrollScheduledToIndex(scheduledCarouselIndex + 1)}
                    className="h-7 w-7 rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 inline-flex items-center justify-center"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={scheduledCarouselRef}
              className={`flex gap-3 ${scheduledCards.length > 1 ? 'overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'overflow-x-hidden'}`}
              onScroll={handleScheduledTrackScroll}
            >
              {scheduledCards.map((tournament) => {
                const tournamentId = tournament.appwriteId || tournament.id;
                const editPending = Boolean(tournamentId && isPendingAction(`setup.edit-scheduled.${String(tournamentId)}`));
                const startPending = Boolean(tournamentId && isPendingAction(`setup.start-scheduled.${String(tournamentId)}`));
                const viewPending = Boolean(tournamentId && isPendingAction(`setup.view-scheduled.${String(tournamentId)}`));
                const deletePending = Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`));
                const alreadyStarted = isScheduledTournamentAlreadyStarted(tournament, activeLiveTournaments);
                const scheduleLabel = formatTournamentDateLabel(tournament.date, 'To be announced');
                return (
                  <div
                    key={tournamentId}
                    className="w-full shrink-0 snap-start rounded-lg border border-indigo-200 bg-white px-3 py-3 setup-scheduled-row"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 break-words leading-snug setup-scheduled-name">{tournament.name}</p>
                        <p className="text-[11px] text-slate-500 break-words setup-scheduled-meta">
                          {scheduleLabel} • {(
                            Array.isArray(tournament.teams)
                              ? tournament.teams.length
                              : (typeof tournament.teamsCount === 'number' ? tournament.teamsCount : 0)
                          )} teams
                        </p>
                        {alreadyStarted && (
                          <p className="text-[11px] font-medium text-amber-700 mt-1 setup-scheduled-started-note">
                            Already started. Resume from Live Tournament.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { void handleViewScheduledCard(tournament); }}
                          disabled={!tournamentId || viewPending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-view-btn"
                        >
                          <Eye size={11} /> {viewPending ? 'Loading...' : 'View'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditScheduledTournament?.(tournamentId)}
                          disabled={!tournamentId || alreadyStarted || editPending || startPending || deletePending || viewPending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-edit-btn"
                        >
                          <PencilLine size={11} /> {editPending ? 'Loading...' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartScheduledTournament?.(tournamentId)}
                          disabled={!tournamentId || alreadyStarted || startPending || deletePending || viewPending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-start-btn"
                        >
                          <Play size={11} /> {alreadyStarted ? 'Started' : (startPending ? 'Starting...' : 'Start')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareScheduledTournament?.(tournament)}
                          disabled={startPending || deletePending || viewPending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-share-btn"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                        {canDeleteActions && (
                          <button
                            type="button"
                            onClick={() => onDeleteTournament?.(tournamentId)}
                            disabled={!tournamentId || deletePending || startPending || editPending || viewPending}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed setup-scheduled-delete-btn"
                          >
                            {deletePending ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {scheduledCards.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {scheduledCards.map((tournament, index) => (
                  <button
                    key={`scheduled-dot-${tournament?.appwriteId || tournament?.id || index}`}
                    type="button"
                    aria-label={`Go to scheduled tournament ${index + 1}`}
                    onClick={() => scrollScheduledToIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === scheduledCarouselIndex ? 'w-5 bg-indigo-600' : 'w-2 bg-indigo-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeLiveTournaments.length > 0 && (
          <div className="mb-4 rounded-xl p-4 setup-highlight-card setup-live-card app-surface-card app-card-tier-secondary">
            <p className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2 setup-live-title">
              <Play size={16} /> Live Tournaments ({activeLiveTournaments.length})
            </p>
            <div className="space-y-2">
              {activeLiveTournaments.map((tournament, index) => {
                const tournamentId = tournament.id || tournament.appwriteId;
                const rowKey = tournamentId || `${tournament.name || 'live'}-${index}`;
                const resumePending = Boolean(isPendingAction(`setup.resume-live.${String(tournamentId || 'active')}`));
                const deletePending = Boolean(isPendingAction(`setup.delete-live.${String(tournamentId || 'active')}`));
                const sportMeta = getSportMeta(tournament?.sportId);
                return (
                  <div key={rowKey} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 setup-live-row">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="setup-sport-badge" aria-hidden>{sportMeta.icon}</span>
                          <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{tournament.name || 'Live tournament'}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 break-words">
                          {sportMeta.label} • {formatTournamentDateLabel(tournament.date, 'Today')} • {(
                            Array.isArray(tournament.teams)
                              ? tournament.teams.length
                              : (typeof tournament.teamsCount === 'number' ? tournament.teamsCount : 0)
                          )} teams
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onResumeActiveTournament?.(tournamentId)}
                        disabled={resumePending || deletePending}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap setup-live-resume-btn"
                      >
                        <Play size={11} /> {resumePending ? 'Resuming...' : 'Resume'}
                      </button>
                      {canDeleteLiveTournament && (
                        <button
                          type="button"
                          onClick={() => onDeleteActiveTournament?.(tournamentId)}
                          disabled={deletePending || resumePending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap setup-live-delete-btn"
                        >
                          {deletePending ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <StartTournamentLane
            sportId={sportId}
            setSportId={setSportId}
            ruleConfig={ruleConfig}
            setRuleConfig={setRuleConfig}
            gameMode={gameMode}
            setGameMode={setGameMode}
            tournamentFormat={tournamentFormat}
            setTournamentFormat={setTournamentFormat}
            format={format}
            setFormat={setFormat}
            numTeamsInput={numTeamsInput}
            setNumTeamsInput={setNumTeamsInput}
            setNumTeams={setNumTeams}
            tournamentName={tournamentName}
            setTournamentName={setTournamentName}
            onNext={onNext}
            startTournamentPending={startTournamentPending}
          />
          <ExploreDataLane
            completedTournamentsCount={completedTournamentsCount}
            casualCount={displayCasualMatches.length}
            totalMatchesPlayed={totalMatchesPlayed}
            topEloPlayer={topEloPlayer}
            showAdvancedActions={showAdvancedActions}
            setShowAdvancedActions={setShowAdvancedActions}
            isMobileViewport={isMobileViewport}
            historyCountLabel={historyCountLabel}
            casualCountLabel={casualCountLabel}
            setShowHistory={setShowHistory}
            setShowCasualHistory={setShowCasualHistory}
            setShowEloLeaderboard={setShowEloLeaderboard}
            setShowAllTimeStats={setShowAllTimeStats}
            setShowPairingAnalytics={setShowPairingAnalytics}
            setShowPowerRankings={setShowPowerRankings}
            tournamentTemplates={tournamentTemplates}
            onSaveTemplate={onSaveTemplate}
            onApplyTemplate={onApplyTemplate}
            onDeleteTemplate={onDeleteTemplate}
            canDeleteActions={canDeleteActionsForExplore}
            gameMode={gameMode}
            tournamentFormat={tournamentFormat}
            format={format}
            numTeams={numTeams}
            playerDatabase={playerDatabase}
            teamNameDatabase={teamNameDatabase}
            narratives={narratives}
          />
        </div>
      </div>
    </div>
  </div>
);

export default SetupScreenDesktop;
