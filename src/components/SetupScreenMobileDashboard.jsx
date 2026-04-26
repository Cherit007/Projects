import React from 'react';
import { MoreVertical } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import TemplateManager from './TemplateManager';
import {
  formatTournamentDateLabel,
  isScheduledTournamentAlreadyStarted,
} from '../utils/appHelpers';

const SetupScreenMobileDashboard = ({
  mobileSetupView,
  setMobileSetupView,
  onOpenUtilityDrawer,
  mobileScrollRef,
  syncChip,
  mobileHeaderTitle,
  mobileHeaderSubtitle,
  selectedGameModeLabel,
  selectedFormatLabel,
  mobileStatsCards,
  topEloPlayer,
  liveInProgressCards,
  completedTournamentsCount,
  narratives,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  format,
  setFormat,
  setNumTeams,
  setNumTeamsInput,
  numTeamsInput,
  tournamentName,
  setTournamentName,
  formatHint,
  startTournamentPending,
  onNext,
  tournamentTemplates,
  playerDatabase,
  teamNameDatabase,
  onSaveTemplate,
  onApplyTemplate,
  applyTemplateToForm,
  onDeleteTemplate,
  dashboardGameModeOptions,
  dashboardFormatOptions,
  dashboardMatchCountOptions,
  mobileLiveTab,
  setMobileLiveTab,
  isPendingAction,
  canDeleteLiveTournament,
  onResumeActiveTournament,
  onDeleteActiveTournament,
  scheduledCards,
  onViewScheduledCard,
  onEditScheduledTournament,
  onStartScheduledTournament,
  onShareScheduledTournament,
  canDeleteActions,
  onDeleteTournament,
  activeLiveTournaments,
  liveCompletedRows,
  onSelectTournament,
  totalMatchesPlayed,
  statsPreviewRows,
  eloGamificationMap,
  getTierMeta,
  casualCountLabel,
  historyCountLabel,
  setShowCasualHistory,
  setShowHistory,
  setShowAllTimeStats,
  mobileEloFilter,
  setMobileEloFilter,
  eloPeriodRows,
  eloFilterLabel,
  premiumEloRows,
  compactEloRows,
  onSelectPlayer,
}) => (
  <div className="theme-page app-screen-home dashboard-v2-page">
    <div className="dashboard-v2-mobile-shell">
      <div className="dashboard-v2-header">
        {mobileSetupView !== 'home' && (
          <button
            type="button"
            className="dashboard-v2-back"
            onClick={() => setMobileSetupView(mobileSetupView === 'elo' ? 'stats' : 'home')}
          >
            ← Back
          </button>
        )}
        <div className="dashboard-v2-header-row">
          <div className="min-w-0">
            <h1 className="dashboard-v2-header-title">{mobileHeaderTitle}</h1>
            <p className="dashboard-v2-header-copy">{mobileHeaderSubtitle}</p>
          </div>
          <button
            type="button"
            className="dashboard-v2-header-action"
            onClick={onOpenUtilityDrawer}
            aria-label="Open quick actions"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div className="dashboard-v2-scroll" ref={mobileScrollRef}>
        {mobileSetupView === 'home' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-sync-row">{syncChip}</div>

            <section className="dashboard-v2-hero">
              <p className="dashboard-v2-hero-label">Start Tournament</p>
              <h2 className="dashboard-v2-hero-title">Create New Tournament</h2>
              <p className="dashboard-v2-hero-copy">
                {selectedGameModeLabel} · {selectedFormatLabel} format
              </p>
              <button
                type="button"
                className="dashboard-v2-primary-btn"
                onClick={() => setMobileSetupView('create')}
              >
                + Create Tournament
              </button>
            </section>

            <section className="dashboard-v2-stats-grid">
              {mobileStatsCards.map((card) => (
                <article key={card.label} className="dashboard-v2-stat-card">
                  <p className="dashboard-v2-stat-icon">{card.icon}</p>
                  <p className="dashboard-v2-stat-value">{card.value}</p>
                  <p className="dashboard-v2-stat-label">{card.label}</p>
                </article>
              ))}
            </section>

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">Quick Access</h2>
                <button
                  type="button"
                  className="dashboard-v2-section-link"
                  onClick={() => setMobileSetupView('stats')}
                >
                  View all
                </button>
              </div>
              <div className="dashboard-v2-card">
                <button
                  type="button"
                  className="dashboard-v2-list-row"
                  onClick={() => setMobileSetupView('elo')}
                >
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-amber">🏅</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">ELO Leaderboard</span>
                    <span className="dashboard-v2-list-subtitle">
                      {topEloPlayer ? `${topEloPlayer.name} leads · ${topEloPlayer.rating} pts` : 'Ranking builds after match results'}
                    </span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
                <button
                  type="button"
                  className="dashboard-v2-list-row"
                  onClick={() => setMobileSetupView('live')}
                >
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-blue">▶️</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">Live Matches</span>
                    <span className="dashboard-v2-list-subtitle">
                      {liveInProgressCards.length > 0 ? `${liveInProgressCards.length} tournament${liveInProgressCards.length === 1 ? '' : 's'} in progress` : 'No live tournament yet'}
                    </span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
                <button
                  type="button"
                  className="dashboard-v2-list-row"
                  onClick={() => setMobileSetupView('stats')}
                >
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-green">📊</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">Insights + History</span>
                    <span className="dashboard-v2-list-subtitle">{completedTournamentsCount} completed tournaments</span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
              </div>
            </section>

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">Live Narrative</h2>
              </div>

              {narratives.streakLeaders?.length > 0 && (
                <div className="dashboard-v2-card dashboard-v2-stack-card">
                  <div className="dashboard-v2-subsection-head">
                    <span>🔥</span>
                    <span>Streak Leaders</span>
                  </div>
                  {narratives.streakLeaders.map((entry, index) => (
                    <div key={`streak-${entry.name}`} className="dashboard-v2-mini-row">
                      <div className="dashboard-v2-mini-rank">{index + 1}</div>
                      <div className="dashboard-v2-mini-name">{entry.name}</div>
                      <span className={`dashboard-v2-pill ${entry.type === 'loss' ? 'is-negative' : 'is-positive'}`}>
                        {entry.count}{entry.type === 'loss' ? 'L' : 'W'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {narratives.formWatch?.length > 0 && (
                <div className="dashboard-v2-card dashboard-v2-stack-card">
                  <div className="dashboard-v2-subsection-head">
                    <span>📈</span>
                    <span>Form Arrows</span>
                  </div>
                  {narratives.formWatch.map((entry) => (
                    <div key={`form-watch-${entry.name}`} className="dashboard-v2-mini-row">
                      <div className="dashboard-v2-mini-name">{entry.name}</div>
                      <div className={`dashboard-v2-trend ${entry.tone === 'up' ? 'is-up' : entry.tone === 'down' ? 'is-down' : ''}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {narratives.rivalries?.length > 0 && (
                <div className="dashboard-v2-card dashboard-v2-stack-card">
                  <div className="dashboard-v2-subsection-head">
                    <span>⚔️</span>
                    <span>Rivalries</span>
                  </div>
                  {narratives.rivalries.map((entry) => (
                    <div key={`rivalry-${entry.teamA}-${entry.teamB}`} className="dashboard-v2-rivalry-row">
                      <div className="dashboard-v2-rivalry-copy">
                        <p>{entry.teamA} vs {entry.teamB}</p>
                        <span>{entry.games} meetings</span>
                      </div>
                      <div className="dashboard-v2-rivalry-bar">
                        <span style={{ width: `${Math.min(100, entry.games * 12)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="dashboard-v2-alert-card">
                <span className="dashboard-v2-alert-icon">✅</span>
                <p className="dashboard-v2-alert-copy">
                  {narratives.upsetWatch?.length > 0
                    ? `${narratives.upsetWatch[0].underdog} is on upset watch in ${narratives.upsetWatch[0].matchup}.`
                    : 'Upset Watch — No high-risk upsets detected.'}
                </p>
              </div>
            </section>
          </div>
        )}

        {mobileSetupView === 'create' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-sync-row">{syncChip}</div>

            <section className="dashboard-v2-card dashboard-v2-create-card">
              <div className="dashboard-v2-form-group">
                <p className="dashboard-v2-form-label">Game Mode</p>
                <div className="dashboard-v2-option-grid dashboard-v2-option-grid-3" role="radiogroup" aria-label="Game Mode">
                  {dashboardGameModeOptions.map((option) => {
                    const selected = gameMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`dashboard-v2-option ${selected ? 'is-selected' : ''}`}
                        onClick={() => setGameMode(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="dashboard-v2-form-group">
                <p className="dashboard-v2-form-label">Tournament Format</p>
                <div className="dashboard-v2-option-grid" role="radiogroup" aria-label="Tournament Format">
                  {dashboardFormatOptions.map((option) => {
                    const selected = tournamentFormat === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`dashboard-v2-option ${selected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setTournamentFormat(option.value);
                          if (option.value === 'knockoutByes' || option.value === 'semiFinal') {
                            setNumTeams(4);
                            setNumTeamsInput('4');
                          } else if (option.value === 'fullKnockout') {
                            setNumTeams(8);
                            setNumTeamsInput('8');
                          } else {
                            setNumTeams(3);
                            setNumTeamsInput('3');
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="dashboard-v2-hint">{formatHint}</p>
              </div>

              {tournamentFormat === 'league' && (
                <div className="dashboard-v2-form-group">
                  <p className="dashboard-v2-form-label">Matches per Pair</p>
                  <div className="dashboard-v2-option-grid" role="radiogroup" aria-label="Matches per Pair">
                    {dashboardMatchCountOptions.map((option) => {
                      const selected = format === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`dashboard-v2-option ${selected ? 'is-selected' : ''}`}
                          onClick={() => setFormat(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="dashboard-v2-form-group">
                <p className="dashboard-v2-form-label">Tournament Name</p>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(event) => setTournamentName(event.target.value)}
                  placeholder="e.g., Summer Smash 2026"
                  className="dashboard-v2-input"
                />
              </div>

              <div className="dashboard-v2-form-group">
                <p className="dashboard-v2-form-label">Number of Teams</p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={numTeamsInput}
                  disabled={tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes'}
                  onChange={(event) => setNumTeamsInput(event.target.value.replace(/\D/g, ''))}
                  className="dashboard-v2-input"
                />
                <p className="dashboard-v2-hint">
                  {tournamentFormat === 'league' && 'Min: 3 · Max: 12 teams'}
                  {tournamentFormat === 'knockoutByes' && 'Min: 3 · Max: 16 teams'}
                  {tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes' && 'Fixed for this format'}
                </p>
              </div>
            </section>

            <div className="dashboard-v2-create-actions">
              <button
                type="button"
                onClick={() => onNext(numTeamsInput)}
                disabled={!tournamentName.trim() || startTournamentPending}
                className="dashboard-v2-primary-btn"
              >
                👥 {startTournamentPending ? 'Starting...' : 'Start Tournament'}
              </button>
              <p className="dashboard-v2-muted-center">Data is auto-saved and synced in real time</p>
            </div>

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">Saved Templates</h2>
              </div>
              <TemplateManager
                templates={tournamentTemplates}
                currentConfig={{ gameMode, tournamentFormat, format, numTeams: Number(numTeamsInput || 0) || 3 }}
                playerSuggestions={playerDatabase}
                teamNameSuggestions={teamNameDatabase}
                onSave={onSaveTemplate}
                onApply={onApplyTemplate}
                onApplyConfig={applyTemplateToForm}
                onDelete={onDeleteTemplate}
              />
            </section>
          </div>
        )}

        {mobileSetupView === 'live' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-filter-tabs" role="tablist" aria-label="Live sections">
              {[
                { key: 'inProgress', label: 'In Progress' },
                { key: 'scheduled', label: 'Scheduled' },
                { key: 'completed', label: 'Completed' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={mobileLiveTab === tab.key}
                  className={`dashboard-v2-filter-tab ${mobileLiveTab === tab.key ? 'is-active' : ''}`}
                  onClick={() => setMobileLiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mobileLiveTab === 'inProgress' && (
              <div className="dashboard-v2-stack">
                {liveInProgressCards.length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No live tournaments yet. Start one from the Create screen.</p>
                  </div>
                ) : (
                  liveInProgressCards.map((card) => {
                    const resumePending = Boolean(isPendingAction(`setup.resume-live.${String(card.id || 'active')}`));
                    const deletePending = Boolean(isPendingAction(`setup.delete-live.${String(card.id || 'active')}`));
                    return (
                      <article key={card.id} className="dashboard-v2-card dashboard-v2-live-card">
                        <div className="dashboard-v2-live-head">
                          <span className="dashboard-v2-pill is-info">Live</span>
                          <span className="dashboard-v2-live-phase">{card.phaseLabel}</span>
                        </div>
                        <h2 className="dashboard-v2-live-title">{card.name}</h2>
                        <p className="dashboard-v2-live-copy">{card.currentMatchLabel}</p>
                        <p className="dashboard-v2-live-copy">{card.completedCount} / {card.totalCount} matches completed</p>
                        <div className="dashboard-v2-inline-actions">
                          <button
                            type="button"
                            className="dashboard-v2-primary-btn dashboard-v2-primary-btn-sm"
                            onClick={() => onResumeActiveTournament?.(card.id)}
                            disabled={resumePending || deletePending}
                          >
                            {resumePending ? 'Resuming...' : 'Resume'}
                          </button>
                          {canDeleteLiveTournament && (
                            <button
                              type="button"
                              className="dashboard-v2-secondary-btn dashboard-v2-danger-btn"
                              onClick={() => onDeleteActiveTournament?.(card.id)}
                              disabled={deletePending || resumePending}
                            >
                              {deletePending ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {mobileLiveTab === 'scheduled' && (
              <div className="dashboard-v2-stack">
                {scheduledCards.length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No scheduled tournaments right now.</p>
                  </div>
                ) : (
                  scheduledCards.map((tournament) => {
                    const tournamentId = tournament.appwriteId || tournament.id;
                    const editPending = Boolean(tournamentId && isPendingAction(`setup.edit-scheduled.${String(tournamentId)}`));
                    const startPending = Boolean(tournamentId && isPendingAction(`setup.start-scheduled.${String(tournamentId)}`));
                    const viewPending = Boolean(tournamentId && isPendingAction(`setup.view-scheduled.${String(tournamentId)}`));
                    const deletePending = Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`));
                    const alreadyStarted = isScheduledTournamentAlreadyStarted(tournament, activeLiveTournaments);
                    return (
                      <article key={tournamentId} className="dashboard-v2-card dashboard-v2-live-card">
                        <div className="dashboard-v2-live-head">
                          <span className="dashboard-v2-pill">Scheduled</span>
                          <span className="dashboard-v2-live-phase">{formatTournamentDateLabel(tournament.date, 'To be announced')}</span>
                        </div>
                        <h2 className="dashboard-v2-live-title">{tournament.name}</h2>
                        <p className="dashboard-v2-live-copy">
                          {(Array.isArray(tournament.teams) ? tournament.teams.length : (typeof tournament.teamsCount === 'number' ? tournament.teamsCount : 0))} teams
                        </p>
                        <div className="dashboard-v2-inline-actions dashboard-v2-inline-actions-wrap">
                          <button
                            type="button"
                            className="dashboard-v2-secondary-btn"
                            onClick={() => { void onViewScheduledCard(tournament); }}
                            disabled={!tournamentId || viewPending}
                          >
                            {viewPending ? 'Loading...' : 'View'}
                          </button>
                          <button
                            type="button"
                            className="dashboard-v2-secondary-btn"
                            onClick={() => onEditScheduledTournament?.(tournamentId)}
                            disabled={!tournamentId || alreadyStarted || editPending || startPending || deletePending || viewPending}
                          >
                            {editPending ? 'Loading...' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            className="dashboard-v2-primary-btn dashboard-v2-primary-btn-sm"
                            onClick={() => onStartScheduledTournament?.(tournamentId)}
                            disabled={!tournamentId || alreadyStarted || startPending || deletePending || viewPending}
                          >
                            {alreadyStarted ? 'Started' : (startPending ? 'Starting...' : 'Start')}
                          </button>
                          <button
                            type="button"
                            className="dashboard-v2-secondary-btn"
                            onClick={() => onShareScheduledTournament?.(tournament)}
                            disabled={startPending || deletePending || viewPending}
                          >
                            WhatsApp
                          </button>
                          {canDeleteActions && (
                            <button
                              type="button"
                              className="dashboard-v2-secondary-btn dashboard-v2-danger-btn"
                              onClick={() => onDeleteTournament?.(tournamentId)}
                              disabled={!tournamentId || deletePending || startPending || editPending || viewPending}
                            >
                              {deletePending ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {mobileLiveTab === 'completed' && (
              <div className="dashboard-v2-stack">
                {liveCompletedRows.length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No completed tournaments yet.</p>
                  </div>
                ) : (
                  liveCompletedRows.map((tournament, index) => (
                    <button
                      key={tournament.id || tournament.appwriteId || `${tournament.name}-${index}`}
                      type="button"
                      className="dashboard-v2-card dashboard-v2-history-card"
                      onClick={() => onSelectTournament(tournament)}
                    >
                      <div className="dashboard-v2-live-head">
                        <span className="dashboard-v2-pill is-positive">Completed</span>
                        <span className="dashboard-v2-live-phase">{formatTournamentDateLabel(tournament.date)}</span>
                      </div>
                      <h2 className="dashboard-v2-live-title">{tournament.name}</h2>
                      <p className="dashboard-v2-live-copy">
                        {tournament.champion?.name ? `${tournament.champion.name} won the title` : 'Tournament completed'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {mobileSetupView === 'stats' && (
          <div className="dashboard-v2-screen">
            <section className="dashboard-v2-stats-grid dashboard-v2-stats-grid-tight">
              <article className="dashboard-v2-stat-card">
                <p className="dashboard-v2-stat-icon">🎯</p>
                <p className="dashboard-v2-stat-value">{totalMatchesPlayed}</p>
                <p className="dashboard-v2-stat-label">Total Matches</p>
              </article>
              <article className="dashboard-v2-stat-card">
                <p className="dashboard-v2-stat-icon">🏆</p>
                <p className="dashboard-v2-stat-value">{topEloPlayer ? topEloPlayer.rating : '--'}</p>
                <p className="dashboard-v2-stat-label">
                  {topEloPlayer ? `Top ELO (${topEloPlayer.name})` : 'Top ELO Pending'}
                </p>
              </article>
            </section>

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">ELO Leaderboard</h2>
                <button
                  type="button"
                  className="dashboard-v2-section-link"
                  onClick={() => setMobileSetupView('elo')}
                >
                  Full list →
                </button>
              </div>
              <div className="dashboard-v2-card">
                {statsPreviewRows.length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No ELO ratings yet. Complete matches to build the leaderboard.</p>
                  </div>
                ) : (
                  statsPreviewRows.map((player, index) => {
                    const lastMatch = player.history?.[player.history.length - 1];
                    const delta = Number(lastMatch?.change || 0);
                    const tier = getTierMeta({
                      rating: player.rating,
                      levelName: eloGamificationMap[player.name]?.level?.name || '',
                    });
                    return (
                      <button
                        key={`stats-preview-${player.name}`}
                        type="button"
                        className="dashboard-v2-list-row"
                        onClick={() => setMobileSetupView('elo')}
                      >
                        <span className={`dashboard-v2-rank-badge is-rank-${Math.min(index + 1, 4)}`}>#{index + 1}</span>
                        <span className="dashboard-v2-list-copy">
                          <span className="dashboard-v2-list-title">{player.name}</span>
                          <span className="dashboard-v2-list-subtitle">ELO {player.rating} · {tier.label}</span>
                        </span>
                        <span className={`dashboard-v2-delta-chip ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">Records</h2>
              </div>
              <div className="dashboard-v2-card">
                <button type="button" className="dashboard-v2-list-row" onClick={() => setShowCasualHistory(true)}>
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-green">📅</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">Casual Matches</span>
                    <span className="dashboard-v2-list-subtitle">{casualCountLabel} casual records</span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
                <button type="button" className="dashboard-v2-list-row" onClick={() => setShowHistory(true)}>
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-amber">🏟️</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">Tournament History</span>
                    <span className="dashboard-v2-list-subtitle">{historyCountLabel} completed entries</span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
                <button type="button" className="dashboard-v2-list-row" onClick={() => setShowAllTimeStats(true)}>
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-blue">📈</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">All-Time Stats</span>
                    <span className="dashboard-v2-list-subtitle">Career summary across tournaments</span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {mobileSetupView === 'elo' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-filter-tabs" role="tablist" aria-label="ELO filters">
              {[
                { key: 'all', label: 'All Time' },
                { key: 'month', label: 'This Month' },
                { key: 'week', label: 'This Week' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={mobileEloFilter === tab.key}
                  className={`dashboard-v2-filter-tab ${mobileEloFilter === tab.key ? 'is-active' : ''}`}
                  onClick={() => setMobileEloFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {eloPeriodRows.length === 0 ? (
              <div className="dashboard-v2-empty-card">
                <p>No ELO activity found for {eloFilterLabel.toLowerCase()}.</p>
              </div>
            ) : (
              <div className="dashboard-v2-stack">
                {premiumEloRows.map((player, index) => {
                  const rank = index + 1;
                  return (
                    <article
                      key={`elo-premium-${player.name}`}
                      className={`dashboard-v2-elo-premium-card is-rank-${rank}`}
                    >
                      <div className="dashboard-v2-elo-premium-top">
                        <span className={`dashboard-v2-rank-badge is-rank-${rank}`}>#{rank}</span>
                        <span className={`dashboard-v2-delta-chip ${player.delta > 0 ? 'is-up' : player.delta < 0 ? 'is-down' : ''}`}>
                          {player.delta > 0 ? '↗' : player.delta < 0 ? '↘' : '•'} {player.delta > 0 ? '+' : ''}{player.delta}
                        </span>
                      </div>
                      <div className="dashboard-v2-elo-player">
                        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size="md" />
                        <button
                          type="button"
                          className={`dashboard-v2-elo-name is-tone-${player.tier.tone}`}
                          onClick={() => onSelectPlayer(player.name)}
                        >
                          {player.name}
                        </button>
                      </div>
                      <div className="dashboard-v2-elo-meta">
                        <span className="dashboard-v2-meta-chip">ELO {player.rating}</span>
                        <span className="dashboard-v2-meta-chip">Matches {player.matchesPlayed}</span>
                      </div>
                      <div className="dashboard-v2-elo-footer">
                        <div>
                          <p className="dashboard-v2-form-label-inline">Recent Form</p>
                          <div className="dashboard-v2-form-track">
                            {(player.recentForm.length > 0 ? player.recentForm : ['D']).map((token, tokenIndex) => (
                              <span
                                key={`premium-form-${player.name}-${tokenIndex}`}
                                className={`dashboard-v2-form-token ${token === 'W' ? 'is-win' : token === 'L' ? 'is-loss' : 'is-draw'}`}
                              >
                                {token}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className={`dashboard-v2-tier-badge is-${player.tier.tone}`}>
                          {player.tier.icon} {player.tier.label}
                        </span>
                      </div>
                    </article>
                  );
                })}

                {compactEloRows.length > 0 && (
                  <div className="dashboard-v2-card">
                    {compactEloRows.map((player, index) => {
                      const rank = index + 4;
                      return (
                        <button
                          key={`elo-compact-${player.name}`}
                          type="button"
                          className="dashboard-v2-elo-list-row"
                          onClick={() => onSelectPlayer(player.name)}
                        >
                          <span className="dashboard-v2-rank-badge is-rank-4">#{rank}</span>
                          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size="sm" />
                          <span className="dashboard-v2-list-copy">
                            <span className="dashboard-v2-list-title">{player.name}</span>
                            <span className="dashboard-v2-list-subtitle">ELO {player.rating} · {player.matchesPlayed} matches</span>
                          </span>
                          <span className="dashboard-v2-compact-side">
                            <span className={`dashboard-v2-tier-pill is-${player.tier.tone}`}>{player.tier.label}</span>
                            <span className={`dashboard-v2-compact-delta ${player.delta > 0 ? 'is-up' : player.delta < 0 ? 'is-down' : ''}`}>
                              {player.delta > 0 ? '+' : ''}{player.delta}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default SetupScreenMobileDashboard;
