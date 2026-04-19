import { useEffect } from 'react';
import { tournamentService } from '../services/tournamentService';
import {
  backfillCasualMatchesCompletedAt,
  backfillTournamentHistoryCompletedAt,
  dedupeLiveTournaments,
  dedupeTournamentHistory,
  sortTournamentHistoryByRecent,
} from '../utils/appHelpers';
import {
  clearAutoResumeSuppressedTournamentId,
  getAutoResumeSuppressedTournamentId,
  tournamentMatchesAutoResumeSuppression,
} from '../utils/autoResumePreference';

const ACTIVE_TOURNAMENT_CACHE_KEY = 'bfm:appwrite-active-tournament';

export const useInitialDataLoadEffect = ({
  isConfigChecked,
  requiresAuth,
  authResolved,
  groupResolved,
  activeGroup,
  activeGroupId,
  isAppwriteEnabled,
  queryClient,
  queryKeys,
  loadFromAppwrite,
  setLoading,
  setMembers,
  hydratePlayerPhotos,
  setPlayerPhotos,
  setPlayerPhotoRefs,
  setTournamentTemplates,
  normalizeTournamentFormat,
  normalizeTemplateTeams,
  setPlayerDatabase,
  setPlayerRatings,
  markRatingsPersisted,
  setTournamentHistory,
  setCasualMatches,
  setHistoryHydrated,
  setCasualHydrated,
  setActiveTournamentLock,
  findActiveTournament,
  resumeActiveTournament,
  mergeMemberLinks,
  applyMemberAccountLinks,
}) => {
  useEffect(() => {
    if (!isConfigChecked) return;
    if (requiresAuth && (!authResolved || !groupResolved || !activeGroup)) return;

    let mounted = true;

    const loadInitialData = async () => {
      setLoading(true);

      try {
        const localMembers = JSON.parse(localStorage.getItem('badminton_members') || '[]');
        const localTemplates = JSON.parse(localStorage.getItem('badminton_templates') || '[]');
        const localPhotos = JSON.parse(localStorage.getItem('badminton_player_photos') || '{}');

        // Local mode
        if (!isAppwriteEnabled) {
          const localPlayers = JSON.parse(localStorage.getItem('badminton_players') || '[]');
          const localRatings = JSON.parse(localStorage.getItem('badminton_ratings') || '{}');
          const localHistory = JSON.parse(localStorage.getItem('badminton_history') || '[]');
          const localCasualMatches = JSON.parse(localStorage.getItem('badminton_casual_matches') || '[]');
          const backfilledLocalHistory = backfillTournamentHistoryCompletedAt(localHistory);
          const backfilledLocalCasual = backfillCasualMatchesCompletedAt(localCasualMatches);
          if (backfilledLocalHistory.changed) {
            localStorage.setItem('badminton_history', JSON.stringify(backfilledLocalHistory.history));
          }
          if (backfilledLocalCasual.changed) {
            localStorage.setItem('badminton_casual_matches', JSON.stringify(backfilledLocalCasual.matches));
          }

          if (mounted) {
            setMembers(localMembers);
            const { urls, refs } = hydratePlayerPhotos(localPhotos);
            setPlayerPhotos(urls);
            setPlayerPhotoRefs(refs);
            setTournamentTemplates(
              localTemplates.map((template) => ({
                ...template,
                tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
                teams: normalizeTemplateTeams(
                  template.teams || [],
                  template.gameMode || 'doubles',
                  template.numTeams || 3
                ),
              }))
            );
            setPlayerDatabase(localPlayers);
            setPlayerRatings(localRatings);
            markRatingsPersisted(localRatings || {});
            setTournamentHistory(sortTournamentHistoryByRecent(
              dedupeTournamentHistory(backfilledLocalHistory.history)
            ));
            setCasualMatches(backfilledLocalCasual.matches);
            setHistoryHydrated(true);
            setCasualHydrated(true);
            const localActiveTournaments = dedupeLiveTournaments(
              dedupeTournamentHistory(backfilledLocalHistory.history)
            );
            const suppressedTournamentId = getAutoResumeSuppressedTournamentId();
            const hasSuppressedActiveTournament = localActiveTournaments.some((tournament) => (
              tournamentMatchesAutoResumeSuppression(tournament, suppressedTournamentId)
            ));
            if (suppressedTournamentId && !hasSuppressedActiveTournament) {
              clearAutoResumeSuppressedTournamentId();
            }
            if (
              localActiveTournaments.length === 1
              && !tournamentMatchesAutoResumeSuppression(
                localActiveTournaments[0],
                suppressedTournamentId
              )
            ) {
              resumeActiveTournament(localActiveTournaments[0]);
            }
          }

          return;
        }

        // Appwrite mode
        const cachedTournamentHistory = queryClient.getQueryData(queryKeys.tournamentHistory(activeGroupId));
        const cachedTournamentSummaries = queryClient.getQueryData(queryKeys.tournamentSummaries(activeGroupId));
        const cachedCasualMatches = queryClient.getQueryData(queryKeys.casualMatches(activeGroupId));
        const cachedBootstrapData = queryClient.getQueryData(queryKeys.appwriteData(activeGroupId));
        const hasCachedTournamentHistory = Array.isArray(cachedTournamentHistory);
        const hasCachedCasualMatches = Array.isArray(cachedCasualMatches);
        const hasCachedLiveSummary = Array.isArray(cachedTournamentSummaries)
          && cachedTournamentSummaries.some((item) => item?.status === 'active' && !item?.champion);
        const hasCachedActiveLock = Boolean(
          cachedBootstrapData
          && typeof cachedBootstrapData === 'object'
          && cachedBootstrapData.activeTournament
          && cachedBootstrapData.activeTournament.status === 'active'
        );
        // Force a fresh read when cached data says there is an active tournament.
        // This prevents stale persisted cache from resurrecting deleted live tournaments across accounts.
        const liveStateStaleTime = (hasCachedLiveSummary || hasCachedActiveLock)
          ? 0
          : (5 * 60 * 1000);

        setHistoryHydrated(hasCachedTournamentHistory);
        setCasualHydrated(hasCachedCasualMatches);
        const normalizedCachedHistory = dedupeTournamentHistory(
          hasCachedTournamentHistory
            ? cachedTournamentHistory
            : (Array.isArray(cachedTournamentSummaries) ? cachedTournamentSummaries : [])
        );
        const backfilledCachedHistory = backfillTournamentHistoryCompletedAt(normalizedCachedHistory);
        const backfilledCachedCasual = backfillCasualMatchesCompletedAt(
          hasCachedCasualMatches ? cachedCasualMatches : []
        );
        setTournamentHistory(sortTournamentHistoryByRecent(backfilledCachedHistory.history));
        setCasualMatches(backfilledCachedCasual.matches);

        const appwriteData = await queryClient.fetchQuery({
          queryKey: queryKeys.appwriteData(activeGroupId),
          queryFn: () => loadFromAppwrite({
            includeTournaments: false,
            includePlayerDatabase: true,
            includeRatings: true,
            includeMeta: true,
          }),
          staleTime: liveStateStaleTime,
        });

        const tournamentSummaries = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentSummaries(activeGroupId),
          queryFn: () => tournamentService.getTournamentSummaries(
            40,
            activeGroupId,
            ['active', 'scheduled', 'completed']
          ),
          staleTime: liveStateStaleTime,
        });

        if (mounted && appwriteData) {
          const appwriteTournaments = dedupeTournamentHistory(tournamentSummaries || []);
          const backfilledAppwriteHistory = backfillTournamentHistoryCompletedAt(appwriteTournaments);
          const activeFromCloud = findActiveTournament(appwriteTournaments);
          setPlayerDatabase(appwriteData.playerDatabase || []);
          setPlayerRatings(appwriteData.playerRatings || {});
          markRatingsPersisted(appwriteData.playerRatings || {});
          const loadedMembers = appwriteData.members?.length ? appwriteData.members : localMembers;
          const restoredMembers = applyMemberAccountLinks(
            mergeMemberLinks(loadedMembers, localMembers),
            appwriteData.memberAccountLinks
          );
          setMembers(restoredMembers);
          const sourcePhotos = Object.keys(appwriteData.playerPhotos || {}).length ? appwriteData.playerPhotos : localPhotos;
          const { urls, refs } = hydratePlayerPhotos(sourcePhotos);
          setPlayerPhotos(urls);
          setPlayerPhotoRefs(refs);
          const sourceTemplates = appwriteData.templates?.length ? appwriteData.templates : localTemplates;
          setTournamentTemplates(
            sourceTemplates.map((template) => ({
              ...template,
              tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
              teams: normalizeTemplateTeams(
                template.teams || [],
                template.gameMode || 'doubles',
                template.numTeams || 3
              ),
            }))
          );
          setHistoryHydrated(false);
          setActiveTournamentLock(appwriteData.activeTournament || null);
          const lock = appwriteData.activeTournament;
          const lockResolvedId = lock?.appwriteId || lock?.id || null;
          let lockCandidate = (lock && lock.status === 'active') ? {
            id: lockResolvedId,
            appwriteId: lockResolvedId,
            legacyTournamentId: lock?.legacyTournamentId || null,
            name: lock.name || 'Live tournament',
            date: lock.updatedAt ? new Date(lock.updatedAt).toLocaleDateString() : '',
            teams: Array.isArray(lock.teams) ? lock.teams : [],
            fixtures: Array.isArray(lock.fixtures) ? lock.fixtures : [],
            bracket: Array.isArray(lock.bracket) ? lock.bracket : [],
            champion: lock.champion || null,
            aiSummaries: Array.isArray(lock.aiSummaries) ? lock.aiSummaries : [],
            swapHistory: Array.isArray(lock.swapHistory) ? lock.swapHistory : [],
            format: lock.format || '1',
            gameMode: lock.gameMode || 'doubles',
            tournamentFormat: normalizeTournamentFormat(lock.tournamentFormat || 'league'),
            status: 'active',
          } : null;
          if (lockCandidate) {
            const lockId = String(lockCandidate.id || lockCandidate.appwriteId || '').trim();
            const lockName = String(lockCandidate.name || '').trim().toLowerCase();
            const lockHasPayload = (
              (Array.isArray(lockCandidate.teams) && lockCandidate.teams.length > 0)
              || (Array.isArray(lockCandidate.fixtures) && lockCandidate.fixtures.length > 0)
              || (
                Array.isArray(lockCandidate.bracket)
                && lockCandidate.bracket.some((round) => Array.isArray(round) && round.length > 0)
              )
            );
            const lockMatchesSummary = (appwriteTournaments || []).some((item) => {
              const summaryId = String(item?.id || item?.appwriteId || '').trim();
              const summaryName = String(item?.name || '').trim().toLowerCase();
              if (item?.status !== 'active' || item?.champion) return false;
              if (lockId) {
                return Boolean(summaryId && lockId === summaryId);
              }
              return Boolean(lockName && summaryName && lockName === summaryName);
            });

            if (!lockMatchesSummary) {
              if (lockId) {
                try {
                  const lockDetail = await tournamentService.getTournamentById(lockId, activeGroupId);
                  if (lockDetail?.status === 'active' && !lockDetail?.champion) {
                    lockCandidate = lockDetail;
                  } else {
                    lockCandidate = null;
                  }
                } catch {
                  lockCandidate = null;
                }
              } else if (!lockHasPayload) {
                lockCandidate = null;
              }
            }
          }
          if (!lockCandidate && lock) {
            setActiveTournamentLock(null);
            queryClient.setQueryData(
              queryKeys.appwriteData(activeGroupId),
              (cached) => {
                if (!cached || typeof cached !== 'object') return cached;
                return {
                  ...cached,
                  activeTournament: null,
                };
              }
            );
          }
          const shouldUseLocalActiveCache = Boolean(isAppwriteEnabled);
          let mergedHistory = backfilledAppwriteHistory.history;
          if (shouldUseLocalActiveCache && !activeFromCloud && !lockCandidate) {
            let cachedActive = null;
            try {
              const raw = localStorage.getItem(ACTIVE_TOURNAMENT_CACHE_KEY);
              cachedActive = raw ? JSON.parse(raw) : null;
            } catch {
              cachedActive = null;
            }
            if (cachedActive) {
              const cachedGroupId = String(cachedActive?._cacheGroupId || cachedActive?.groupId || '').trim();
              if (cachedGroupId && activeGroupId && cachedGroupId !== String(activeGroupId)) {
                cachedActive = null;
              }
              const cachedAtMs = Date.parse(String(cachedActive?._cachedAt || ''));
              if (Number.isFinite(cachedAtMs) && Date.now() - cachedAtMs > 7 * 24 * 60 * 60 * 1000) {
                cachedActive = null;
              }
            }
            const { _cacheGroupId, _cachedAt, ...cacheTournament } = cachedActive || {};
            const cacheHasPayload = Boolean(
              cacheTournament
              && (
                (Array.isArray(cacheTournament.teams) && cacheTournament.teams.length > 0)
                || (Array.isArray(cacheTournament.fixtures) && cacheTournament.fixtures.length > 0)
                || (Array.isArray(cacheTournament.bracket) && cacheTournament.bracket.length > 0)
              )
            );
            if (
              cacheTournament
              && cacheTournament.status === 'active'
              && !cacheTournament.champion
              && cacheHasPayload
            ) {
              const normalizedCache = {
                ...cacheTournament,
                tournamentFormat: normalizeTournamentFormat(
                  cacheTournament.tournamentFormat || cacheTournament.format || 'league'
                ),
                status: 'active',
              };
              mergedHistory = dedupeTournamentHistory([normalizedCache, ...mergedHistory]);
            }
          }
          setTournamentHistory(sortTournamentHistoryByRecent(mergedHistory));
          const scoreTournament = (tournament) => {
            const completedFixtures = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
              .filter((match) => match?.completed).length;
            const completedBracket = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
              .flatMap((round) => (Array.isArray(round) ? round : []))
              .filter((match) => match?.completed).length;
            return completedFixtures + completedBracket + (tournament?.champion ? 10000 : 0);
          };
          const preferredActive = activeFromCloud && lockCandidate
            ? (scoreTournament(lockCandidate) > scoreTournament(activeFromCloud) ? lockCandidate : activeFromCloud)
            : (activeFromCloud || lockCandidate);
          const dedupedLiveTournaments = dedupeLiveTournaments([
            ...(Array.isArray(appwriteTournaments) ? appwriteTournaments : []),
            ...(lockCandidate ? [lockCandidate] : []),
          ]);
          const hasMultipleLiveTournaments = dedupedLiveTournaments.length > 1;
          const hasDetailedCloudState = Boolean(
            preferredActive
            && (
              (Array.isArray(preferredActive.fixtures) && preferredActive.fixtures.length > 0)
              || (Array.isArray(preferredActive.bracket) && preferredActive.bracket.length > 0)
              || (Array.isArray(preferredActive.teams) && preferredActive.teams.length > 0 && !preferredActive.isSummary)
            )
          );
          if (preferredActive && hasDetailedCloudState && !hasMultipleLiveTournaments) {
            resumeActiveTournament(preferredActive);
          }
        }
      } catch (error) {
        console.error('Error loading:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [isAppwriteEnabled, isConfigChecked, requiresAuth, authResolved, groupResolved, activeGroupId, queryClient]);
};
