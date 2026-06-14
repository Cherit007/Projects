import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APP_ROUTE_KEYS,
  buildAppHash,
  deriveRouteKeyFromAppState,
  parseAppRoute,
} from '../utils/appRoutes';
import { getLastSportForGroup } from '../utils/activeSportStorage';

const scrollToTopSafely = () => {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignore jsdom / browser limitations.
    }
  }
};

const updateHashRoute = (routeKey, { sportId = null, replace = false } = {}) => {
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

export const useHashAppRoute = ({
  isReady = false,
  requiresAuth = false,
  groupsEnabled = true,
  currentUser = null,
  isGuestViewer = false,
  activeGroup = null,
  activeGroupId = null,
  groupRole = null,
  showRequestCenter = false,
  setShowRequestCenter = () => {},
  isViewerMode = false,
  step = 'setup',
  setStep = () => {},
  sportId = 'badminton',
  setSportId = () => {},
  applySportContext = () => {},
  hasTournamentScreenState = false,
}) => {
  const [preferSportHub, setPreferSportHub] = useState(() => groupsEnabled);
  const [routeSportId, setRouteSportId] = useState(null);

  const derivedRouteKey = useMemo(() => deriveRouteKeyFromAppState({
    requiresAuth,
    groupsEnabled,
    currentUser,
    isGuestViewer,
    activeGroup,
    groupRole,
    showRequestCenter,
    isViewerMode,
    step,
    sportHubActive: preferSportHub && step === 'setup',
  }), [
    requiresAuth,
    groupsEnabled,
    currentUser,
    isGuestViewer,
    activeGroup,
    groupRole,
    showRequestCenter,
    isViewerMode,
    step,
    preferSportHub,
  ]);

  const derivedRouteRef = useRef(derivedRouteKey);
  const previousDerivedRouteRef = useRef(null);
  const applyRequestedRouteRef = useRef(null);
  const [routeKey, setRouteKey] = useState(derivedRouteKey);

  useEffect(() => {
    derivedRouteRef.current = derivedRouteKey;
  }, [derivedRouteKey]);

  const applyRequestedRoute = useCallback((requestedRouteKey, requestedSportId = null) => {
    if (!requestedRouteKey) return false;

    switch (requestedRouteKey) {
      case APP_ROUTE_KEYS.AUTH:
        return Boolean(requiresAuth && !currentUser && !isGuestViewer);
      case APP_ROUTE_KEYS.GROUPS:
        if (!requiresAuth || !groupsEnabled) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        return Boolean(currentUser || isGuestViewer);
      case APP_ROUTE_KEYS.GROUP_REQUESTS:
        if (!(requiresAuth && groupsEnabled && activeGroup && groupRole === 'admin')) return false;
        if (!showRequestCenter) {
          setShowRequestCenter(true);
        }
        return true;
      case APP_ROUTE_KEYS.VIEWER:
        return Boolean(isViewerMode);
      case APP_ROUTE_KEYS.SPORT_HUB:
        if (requiresAuth && groupsEnabled && !activeGroup) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        setPreferSportHub(true);
        setRouteSportId(null);
        if (step !== 'setup') {
          setStep('setup');
        }
        return true;
      case APP_ROUTE_KEYS.SETUP:
        if (requiresAuth && groupsEnabled && !activeGroup) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        setPreferSportHub(false);
        if (requestedSportId) {
          applySportContext(requestedSportId);
          setRouteSportId(requestedSportId);
        } else if (activeGroupId) {
          const fallbackSportId = getLastSportForGroup(activeGroupId);
          applySportContext(fallbackSportId);
          setRouteSportId(fallbackSportId);
        }
        if (step !== 'setup') {
          setStep('setup');
        }
        return true;
      case APP_ROUTE_KEYS.TEAMS:
        if (requiresAuth && groupsEnabled && !activeGroup) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        setPreferSportHub(false);
        if (requestedSportId) {
          applySportContext(requestedSportId);
          setRouteSportId(requestedSportId);
        }
        if (step !== 'teams') {
          setStep('teams');
        }
        return true;
      case APP_ROUTE_KEYS.TOURNAMENT:
        if ((requiresAuth && groupsEnabled && !activeGroup) || !hasTournamentScreenState) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        setPreferSportHub(false);
        if (requestedSportId) {
          applySportContext(requestedSportId);
          setRouteSportId(requestedSportId);
        }
        if (step !== 'tournament') {
          setStep('tournament');
        }
        return true;
      default:
        return false;
    }
  }, [
    activeGroup,
    activeGroupId,
    applySportContext,
    currentUser,
    groupRole,
    groupsEnabled,
    hasTournamentScreenState,
    isGuestViewer,
    isViewerMode,
    requiresAuth,
    setShowRequestCenter,
    setStep,
    showRequestCenter,
    step,
  ]);

  useEffect(() => {
    applyRequestedRouteRef.current = applyRequestedRoute;
  }, [applyRequestedRoute]);

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return undefined;

    const syncFromHash = () => {
      const parsed = parseAppRoute(window.location.hash);
      const fallbackRouteKey = derivedRouteRef.current;
      const applied = applyRequestedRouteRef.current
        ? applyRequestedRouteRef.current(parsed.routeKey, parsed.sportId)
        : false;
      const effectiveRouteKey = applied && parsed.routeKey ? parsed.routeKey : fallbackRouteKey;
      const effectiveSportId = applied && parsed.sportId
        ? parsed.sportId
        : (routeSportId || sportId);
      if (!parsed.routeKey || !applied) {
        updateHashRoute(effectiveRouteKey, {
          sportId: effectiveRouteKey === APP_ROUTE_KEYS.SPORT_HUB ? null : effectiveSportId,
          replace: true,
        });
      }
      setRouteKey(effectiveRouteKey);
      scrollToTopSafely();
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [isReady, routeSportId, sportId]);

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return;

    const previousDerived = previousDerivedRouteRef.current;
    previousDerivedRouteRef.current = derivedRouteKey;

    if (previousDerived === null) {
      const parsed = parseAppRoute(window.location.hash);
      if (!parsed.routeKey) {
        updateHashRoute(derivedRouteKey, {
          sportId: derivedRouteKey === APP_ROUTE_KEYS.SPORT_HUB ? null : sportId,
          replace: true,
        });
        setRouteKey(derivedRouteKey);
      }
      return;
    }

    if (previousDerived === derivedRouteKey) return;

    const currentParsed = parseAppRoute(window.location.hash);
    if (currentParsed.routeKey === derivedRouteKey
      && (derivedRouteKey === APP_ROUTE_KEYS.SPORT_HUB || currentParsed.sportId === sportId)) {
      setRouteKey(derivedRouteKey);
      return;
    }

    updateHashRoute(derivedRouteKey, {
      sportId: derivedRouteKey === APP_ROUTE_KEYS.SPORT_HUB ? null : sportId,
    });
    setRouteKey(derivedRouteKey);
    scrollToTopSafely();
  }, [derivedRouteKey, isReady, sportId]);

  const openSportHub = useCallback(() => {
    setPreferSportHub(true);
    updateHashRoute(APP_ROUTE_KEYS.SPORT_HUB);
    setRouteKey(APP_ROUTE_KEYS.SPORT_HUB);
    if (step !== 'setup') {
      setStep('setup');
    }
    scrollToTopSafely();
  }, [setStep, step]);

  const openSportHome = useCallback((nextSportId = sportId) => {
    if (!nextSportId) {
      openSportHub();
      return;
    }
    setPreferSportHub(false);
    applySportContext(nextSportId);
    setRouteSportId(nextSportId);
    updateHashRoute(APP_ROUTE_KEYS.SETUP, { sportId: nextSportId });
    setRouteKey(APP_ROUTE_KEYS.SETUP);
    if (step !== 'setup') {
      setStep('setup');
    }
    scrollToTopSafely();
  }, [applySportContext, openSportHub, setStep, sportId, step]);

  return {
    routeKey,
    derivedRouteKey,
    preferSportHub,
    setPreferSportHub,
    openSportHub,
    openSportHome,
  };
};
