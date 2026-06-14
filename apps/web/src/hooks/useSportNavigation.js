import { useCallback } from 'react';
import { APP_ROUTE_KEYS, buildAppHash } from '../utils/appRoutes';
import { setLastSportForGroup } from '../utils/activeSportStorage';
import { applySportChange } from '../components/setup/tournamentSetupUtils';
import { getSportSetupConfig } from '../components/setup/sportSetupConfig';

const updateHash = (routeKey, { sportId = null, replace = false } = {}) => {
  if (typeof window === 'undefined') return;
  const nextHash = buildAppHash(routeKey, { sportId });
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (replace) {
    window.history.replaceState(window.history.state, '', nextUrl);
  } else {
    window.history.pushState(window.history.state, '', nextUrl);
  }
  if (window.location.hash !== nextHash) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
};

export const useSportNavigation = ({
  activeGroupId,
  sportId,
  setSportId,
  setRuleConfig,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  format,
  setFormat,
  setNumTeams,
  setNumTeamsInput,
}) => {
  const applySportContext = useCallback((nextSportId) => {
    applySportChange(nextSportId, {
      setSportId,
      setRuleConfig,
      gameMode,
      setGameMode,
      tournamentFormat,
      setTournamentFormat,
      format,
      setFormat,
      setNumTeams,
      setNumTeamsInput,
      getSportSetupConfig,
    });
    if (activeGroupId) {
      setLastSportForGroup(activeGroupId, nextSportId);
    }
  }, [
    activeGroupId,
    format,
    gameMode,
    setFormat,
    setGameMode,
    setNumTeams,
    setNumTeamsInput,
    setRuleConfig,
    setSportId,
    setTournamentFormat,
    tournamentFormat,
  ]);

  const navigateToSportHub = useCallback(({ replace = false } = {}) => {
    updateHash(APP_ROUTE_KEYS.SPORT_HUB, { replace });
  }, []);

  const navigateToSportHome = useCallback((nextSportId = sportId, { replace = false } = {}) => {
    if (!nextSportId) {
      navigateToSportHub({ replace });
      return;
    }
    applySportContext(nextSportId);
    updateHash(APP_ROUTE_KEYS.SETUP, { sportId: nextSportId, replace });
  }, [applySportContext, navigateToSportHub, sportId]);

  const navigateToSportTeams = useCallback((nextSportId = sportId, { replace = false } = {}) => {
    if (!nextSportId) return;
    updateHash(APP_ROUTE_KEYS.TEAMS, { sportId: nextSportId, replace });
  }, [sportId]);

  const navigateToSportLive = useCallback((nextSportId = sportId, { replace = false } = {}) => {
    if (!nextSportId) return;
    updateHash(APP_ROUTE_KEYS.TOURNAMENT, { sportId: nextSportId, replace });
  }, [sportId]);

  return {
    applySportContext,
    navigateToSportHub,
    navigateToSportHome,
    navigateToSportTeams,
    navigateToSportLive,
  };
};
