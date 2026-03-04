import { useEffect } from 'react';
import { tournamentService } from '../services/tournamentService';

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
            setTournamentHistory(localHistory);
            setCasualMatches(localCasualMatches);
            setHistoryHydrated(true);
            setCasualHydrated(true);
            const localActive = findActiveTournament(localHistory);
            resumeActiveTournament(localActive);
          }

          return;
        }

        // Appwrite mode
        const cachedTournamentHistory = queryClient.getQueryData(queryKeys.tournamentHistory(activeGroupId));
        const cachedTournamentSummaries = queryClient.getQueryData(queryKeys.tournamentSummaries(activeGroupId));
        const cachedCasualMatches = queryClient.getQueryData(queryKeys.casualMatches(activeGroupId));
        const hasCachedTournamentHistory = Array.isArray(cachedTournamentHistory);
        const hasCachedCasualMatches = Array.isArray(cachedCasualMatches);

        setHistoryHydrated(hasCachedTournamentHistory);
        setCasualHydrated(hasCachedCasualMatches);
        setTournamentHistory(
          hasCachedTournamentHistory
            ? cachedTournamentHistory
            : (Array.isArray(cachedTournamentSummaries) ? cachedTournamentSummaries : [])
        );
        setCasualMatches(hasCachedCasualMatches ? cachedCasualMatches : []);

        const appwriteData = await queryClient.fetchQuery({
          queryKey: queryKeys.appwriteData(activeGroupId),
          queryFn: () => loadFromAppwrite({
            includeTournaments: false,
            includePlayerDatabase: true,
            includeRatings: true,
            includeMeta: true,
          }),
          staleTime: 5 * 60 * 1000,
        });

        const tournamentSummaries = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentSummaries(activeGroupId),
          queryFn: () => tournamentService.getTournamentSummaries(40, activeGroupId, ['active', 'scheduled']),
          staleTime: 5 * 60 * 1000,
        });

        if (mounted && appwriteData) {
          const appwriteTournaments = tournamentSummaries || [];
          setTournamentHistory(appwriteTournaments);
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
          const activeFromCloud = findActiveTournament(appwriteTournaments);
          const lock = appwriteData.activeTournament;
          const lockCandidate = (lock && lock.status === 'active') ? {
            id: lock.id || null,
            appwriteId: lock.id || null,
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
          const hasDetailedCloudState = Boolean(
            preferredActive
            && (
              (Array.isArray(preferredActive.fixtures) && preferredActive.fixtures.length > 0)
              || (Array.isArray(preferredActive.bracket) && preferredActive.bracket.length > 0)
              || (Array.isArray(preferredActive.teams) && preferredActive.teams.length > 0 && !preferredActive.isSummary)
            )
          );
          if (preferredActive && hasDetailedCloudState) {
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
