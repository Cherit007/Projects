import React from 'react';
import { MoreVertical } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import TemplateManager from './TemplateManager';
import {
  formatTournamentDateLabel,
  isScheduledTournamentAlreadyStarted,
} from '../utils/appHelpers';
import TournamentSetupForm from './setup/TournamentSetupForm';
import MatchTypePicker from './setup/MatchTypePicker';
import CasualMatchFlow from './setup/CasualMatchFlow';

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
  sportId,
  setSportId,
  ruleConfig,
  setRuleConfig,
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
  startTournamentPending,
  onNext,
  tournamentTemplates,
  playerDatabase,
  teamNameDatabase,
  onSaveTemplate,
  onApplyTemplate,
  applyTemplateToForm,
  onDeleteTemplate,
  mobileLiveTab,
  setMobileLiveTab,
  isPendingAction,
  canDeleteLiveTournament,
  onResumeActiveTournament,
  onDeleteActiveTournament,
  onResumeCasualDraft,
  onDeleteCasualDraft,
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
  onSelectCasualMatch,
  formatCasualTeam,
  formatCasualScoreLine,
  formatCasualMatchMeta,
  hasViewableBoxCricketDetail,
  totalMatchesPlayed,
  statsPreviewRows,
  allTimeStatsPreview = [],
  isBoxCricketStats = false,
  boxCricketStatsTab = 'runs',
  setBoxCricketStatsTab = () => {},
  boxCricketStatsRows = [],
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
  hideEloFeatures = false,
  casualMatchProps = {},
}) => (
  <div className="theme-page app-screen-home dashboard-v2-page">
    <div className="dashboard-v2-mobile-shell">
      <div className="dashboard-v2-header">
        {mobileSetupView !== 'home' && (
          <button
            type="button"
            className="dashboard-v2-back"
            onClick={() => {
              if (mobileSetupView === 'elo') {
                setMobileSetupView('stats');
                return;
              }
              if (mobileSetupView === 'create' || mobileSetupView === 'casual') {
                setMobileSetupView('start');
                return;
              }
              setMobileSetupView('home');
            }}
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
              <p className="dashboard-v2-hero-label">Start match</p>
              <h2 className="dashboard-v2-hero-title">Casual or tournament</h2>
              <p className="dashboard-v2-hero-copy">
                {selectedGameModeLabel} · {selectedFormatLabel} format
              </p>
              <button
                type="button"
                className="dashboard-v2-primary-btn"
                onClick={() => setMobileSetupView('start')}
              >
                + Start Match
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
                {!hideEloFeatures && (
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
                )}
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
                    <span className="dashboard-v2-list-subtitle">{historyCountLabel} tournaments & casual matches</span>
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

        {mobileSetupView === 'start' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-sync-row">{syncChip}</div>
            <section className="dashboard-v2-card dashboard-v2-create-card tournament-setup-shell">
              <MatchTypePicker
                value=""
                onChange={(nextType) => setMobileSetupView(nextType === 'casual' ? 'casual' : 'create')}
              />
            </section>
          </div>
        )}

        {mobileSetupView === 'casual' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-sync-row">{syncChip}</div>
            <CasualMatchFlow
              layout="inline"
              sportId={sportId}
              ruleConfig={ruleConfig}
              {...casualMatchProps}
              onClose={() => setMobileSetupView('home')}
            />
          </div>
        )}

        {mobileSetupView === 'create' && (
          <div className="dashboard-v2-screen">
            <div className="dashboard-v2-sync-row">{syncChip}</div>

            <section className="dashboard-v2-card dashboard-v2-create-card tournament-setup-shell">
              <button
                type="button"
                className="start-match-back-link mb-3"
                onClick={() => setMobileSetupView('start')}
              >
                ← Back to format
              </button>
              <TournamentSetupForm
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
                showHeader={false}
                excludeCasualFormat
                setupEyebrow="Start match"
                setupTitle="Tournament setup"
                className="tournament-setup-form-mobile"
              />
            </section>

            <div className="dashboard-v2-create-actions tournament-setup-mobile-actions">
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
                    <p>No live matches yet. Start a casual match or tournament from Create.</p>
                  </div>
                ) : (
                  liveInProgressCards.map((card) => {
                    const isCasualDraft = card.kind === 'casualDraft';
                    const resumePending = Boolean(isPendingAction(
                      isCasualDraft ? 'setup.resume-casual-draft' : `setup.resume-live.${String(card.id || 'active')}`,
                    ));
                    const deletePending = Boolean(isPendingAction(
                      isCasualDraft ? 'setup.delete-casual-draft' : `setup.delete-live.${String(card.id || 'active')}`,
                    ));
                    return (
                      <article key={card.id} className="dashboard-v2-card dashboard-v2-live-card">
                        <div className="dashboard-v2-live-head">
                          <span className="dashboard-v2-pill is-info">Live</span>
                          <span className="dashboard-v2-live-phase">{card.sportIcon} {card.sportLabel}</span>
                        </div>
                        <h2 className="dashboard-v2-live-title">{card.name}</h2>
                        <p className="dashboard-v2-live-copy">{card.phaseLabel}</p>
                        <p className="dashboard-v2-live-copy">{card.currentMatchLabel}</p>
                        <p className="dashboard-v2-live-copy">{card.completedCount} / {card.totalCount} matches completed</p>
                        <div className="dashboard-v2-inline-actions">
                          <button
                            type="button"
                            className="dashboard-v2-primary-btn dashboard-v2-primary-btn-sm"
                            onClick={() => {
                              if (isCasualDraft) {
                                onResumeCasualDraft?.();
                                return;
                              }
                              onResumeActiveTournament?.(card.id);
                            }}
                            disabled={resumePending || deletePending}
                          >
                            {resumePending ? 'Resuming...' : 'Resume'}
                          </button>
                          {canDeleteLiveTournament && (
                            <button
                              type="button"
                              className="dashboard-v2-secondary-btn dashboard-v2-danger-btn"
                              onClick={() => {
                                if (isCasualDraft) {
                                  onDeleteCasualDraft?.();
                                  return;
                                }
                                onDeleteActiveTournament?.(card.id);
                              }}
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

            {mobileLiveTab === 'completed' && (
              <div className="dashboard-v2-stack">
                {liveCompletedRows.length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No completed matches yet.</p>
                  </div>
                ) : (
                  liveCompletedRows.map((entry) => {
                    if (entry.kind === 'casual') {
                      const match = entry.match;
                      const team1Name = formatCasualTeam(match.team1, match);
                      const team2Name = formatCasualTeam(match.team2, match);
                      const score1 = Number(match.score1);
                      const score2 = Number(match.score2);
                      const isTeam1Winner = score1 > score2;
                      const canView = hasViewableBoxCricketDetail?.(match);
                      return (
                        <div
                          key={entry.id}
                          className="dashboard-v2-card dashboard-v2-history-card"
                        >
                          <div className="dashboard-v2-live-head">
                            <span className="dashboard-v2-pill is-positive">Casual</span>
                            <span className="dashboard-v2-live-phase">
                              {new Date(match.date || match.completedAt || match.createdAt || Date.now()).toLocaleString()}
                            </span>
                          </div>
                          <h2 className="dashboard-v2-live-title">
                            <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span>
                            {' vs '}
                            <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
                          </h2>
                          <p className="dashboard-v2-live-copy">
                            Score: {formatCasualScoreLine(match, team1Name, team2Name)}
                          </p>
                          <p className="dashboard-v2-live-copy">{formatCasualMatchMeta(match)}</p>
                          {canView && (
                            <div className="dashboard-v2-inline-actions">
                              <button
                                type="button"
                                className="dashboard-v2-primary-btn dashboard-v2-primary-btn-sm"
                                onClick={() => onSelectCasualMatch?.(match)}
                              >
                                View
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const tournament = entry.tournament;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="dashboard-v2-card dashboard-v2-history-card"
                        onClick={() => onSelectTournament(tournament)}
                      >
                        <div className="dashboard-v2-live-head">
                          <span className="dashboard-v2-pill is-positive">Tournament</span>
                          <span className="dashboard-v2-live-phase">{formatTournamentDateLabel(tournament.date)}</span>
                        </div>
                        <h2 className="dashboard-v2-live-title">{tournament.name}</h2>
                        <p className="dashboard-v2-live-copy">
                          {tournament.champion?.name ? `${tournament.champion.name} won the title` : 'Tournament completed'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {mobileSetupView === 'stats' && (
          <div className="dashboard-v2-screen">
            {isBoxCricketStats && (
              <div className="dashboard-v2-filter-tabs" role="tablist" aria-label="Box cricket stat leaders">
                {[
                  { key: 'runs', label: 'Top Scorers' },
                  { key: 'wickets', label: 'Top Wicket Takers' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={boxCricketStatsTab === tab.key}
                    className={`dashboard-v2-filter-tab ${boxCricketStatsTab === tab.key ? 'is-active' : ''}`}
                    onClick={() => setBoxCricketStatsTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <section className="dashboard-v2-stats-grid dashboard-v2-stats-grid-tight">
              <article className="dashboard-v2-stat-card">
                <p className="dashboard-v2-stat-icon">🎯</p>
                <p className="dashboard-v2-stat-value">{totalMatchesPlayed}</p>
                <p className="dashboard-v2-stat-label">Total Matches</p>
              </article>
              {!hideEloFeatures && (
              <article className="dashboard-v2-stat-card">
                <p className="dashboard-v2-stat-icon">🏆</p>
                <p className="dashboard-v2-stat-value">{topEloPlayer ? topEloPlayer.rating : '--'}</p>
                <p className="dashboard-v2-stat-label">
                  {topEloPlayer ? `Top ELO (${topEloPlayer.name})` : 'Top ELO Pending'}
                </p>
              </article>
              )}
            </section>

            {!hideEloFeatures && (
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
            )}

            {hideEloFeatures && (
            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">
                  {boxCricketStatsTab === 'wickets' ? 'Top Wicket Takers' : 'Top Scorers'}
                </h2>
                <button
                  type="button"
                  className="dashboard-v2-section-link"
                  onClick={() => setShowAllTimeStats(true)}
                >
                  Full list →
                </button>
              </div>
              <div className="dashboard-v2-card">
                {(boxCricketStatsRows.length > 0 ? boxCricketStatsRows : allTimeStatsPreview).length === 0 ? (
                  <div className="dashboard-v2-empty-card">
                    <p>No player stats yet. Finish ball-by-ball matches to build career stats.</p>
                  </div>
                ) : (
                  (boxCricketStatsRows.length > 0 ? boxCricketStatsRows : allTimeStatsPreview).slice(0, 5).map((player, index) => (
                    <button
                      key={`all-time-preview-${player.name}`}
                      type="button"
                      className="dashboard-v2-list-row"
                      onClick={() => onSelectPlayer(player.name)}
                    >
                      <span className="dashboard-v2-list-icon dashboard-v2-list-icon-blue">#{index + 1}</span>
                      <span className="dashboard-v2-list-copy">
                        <span className="dashboard-v2-list-title">{player.name}</span>
                        <span className="dashboard-v2-list-subtitle">
                          {boxCricketStatsTab === 'wickets'
                            ? `${player.cricketWickets || 0} wkts · ${player.cricketRuns || 0} runs · ${player.matchesWon || 0} wins`
                            : `${player.cricketRuns || 0} runs · ${player.cricketWickets || 0} wkts · ${player.matchesWon || 0} wins`}
                        </span>
                      </span>
                      <span className="dashboard-v2-list-chevron">›</span>
                    </button>
                  ))
                )}
              </div>
            </section>
            )}

            <section className="dashboard-v2-section">
              <div className="dashboard-v2-section-head">
                <h2 className="dashboard-v2-section-title">Records</h2>
              </div>
              <div className="dashboard-v2-card">
                <button type="button" className="dashboard-v2-list-row" onClick={() => setShowHistory(true)}>
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-amber">📜</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">History</span>
                    <span className="dashboard-v2-list-subtitle">{historyCountLabel} tournaments & casual matches</span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
                <button type="button" className="dashboard-v2-list-row" onClick={() => setShowAllTimeStats(true)}>
                  <span className="dashboard-v2-list-icon dashboard-v2-list-icon-blue">📈</span>
                  <span className="dashboard-v2-list-copy">
                    <span className="dashboard-v2-list-title">All-Time Stats</span>
                    <span className="dashboard-v2-list-subtitle">
                      {isBoxCricketStats ? 'Career runs, wickets and wins' : 'Career summary across tournaments'}
                    </span>
                  </span>
                  <span className="dashboard-v2-list-chevron">›</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {mobileSetupView === 'elo' && !hideEloFeatures && (
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
