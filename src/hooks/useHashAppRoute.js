import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APP_ROUTE_KEYS,
  deriveRouteKeyFromAppState,
  getHashForRouteKey,
  parseHashRouteKey,
} from '../utils/appRoutes';

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

const updateHashRoute = (routeKey, { replace = false } = {}) => {
  if (typeof window === 'undefined') return;
  const nextHash = getHashForRouteKey(routeKey);
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (replace) {
    window.history.replaceState(window.history.state, '', nextUrl);
  } else {
    window.history.pushState(window.history.state, '', nextUrl);
  }
  // Keep location.hash in sync for environments where pushState does not update it (jsdom).
  if (window.location.hash !== nextHash) {
    const { history } = window;
    history.replaceState(history.state, '', nextUrl);
  }
};

export const useHashAppRoute = ({
  isReady = false,
  requiresAuth = false,
  currentUser = null,
  isGuestViewer = false,
  activeGroup = null,
  groupRole = null,
  showRequestCenter = false,
  setShowRequestCenter = () => {},
  isViewerMode = false,
  step = 'setup',
  setStep = () => {},
  hasTournamentScreenState = false,
}) => {
  const derivedRouteKey = useMemo(() => deriveRouteKeyFromAppState({
    requiresAuth,
    currentUser,
    isGuestViewer,
    activeGroup,
    groupRole,
    showRequestCenter,
    isViewerMode,
    step,
  }), [
    requiresAuth,
    currentUser,
    isGuestViewer,
    activeGroup,
    groupRole,
    showRequestCenter,
    isViewerMode,
    step,
  ]);
  const derivedRouteRef = useRef(derivedRouteKey);
  const previousDerivedRouteRef = useRef(null);
  const applyRequestedRouteRef = useRef(null);
  const [routeKey, setRouteKey] = useState(derivedRouteKey);

  useEffect(() => {
    derivedRouteRef.current = derivedRouteKey;
  }, [derivedRouteKey]);

  const applyRequestedRoute = useCallback((requestedRouteKey) => {
    if (!requestedRouteKey) return false;

    switch (requestedRouteKey) {
      case APP_ROUTE_KEYS.AUTH:
        return Boolean(requiresAuth && !currentUser && !isGuestViewer);
      case APP_ROUTE_KEYS.GROUPS:
        if (!requiresAuth) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        return Boolean(currentUser || isGuestViewer);
      case APP_ROUTE_KEYS.GROUP_REQUESTS:
        if (!(requiresAuth && activeGroup && groupRole === 'admin')) return false;
        if (!showRequestCenter) {
          setShowRequestCenter(true);
        }
        return true;
      case APP_ROUTE_KEYS.VIEWER:
        return Boolean(isViewerMode);
      case APP_ROUTE_KEYS.SETUP:
        if (requiresAuth && !activeGroup) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        if (step !== 'setup') {
          setStep('setup');
        }
        return true;
      case APP_ROUTE_KEYS.TEAMS:
        if (requiresAuth && !activeGroup) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
        }
        if (step !== 'teams') {
          setStep('teams');
        }
        return true;
      case APP_ROUTE_KEYS.TOURNAMENT:
        if ((requiresAuth && !activeGroup) || !hasTournamentScreenState) return false;
        if (showRequestCenter) {
          setShowRequestCenter(false);
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
    currentUser,
    groupRole,
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

  // Hash → app state: only on mount / readiness and explicit hash navigation.
  // Do not re-sync when step changes from in-app actions — that fights state → hash sync below.
  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return undefined;

    const syncFromHash = () => {
      const requestedRouteKey = parseHashRouteKey(window.location.hash);
      const fallbackRouteKey = derivedRouteRef.current;
      const applied = applyRequestedRouteRef.current
        ? applyRequestedRouteRef.current(requestedRouteKey)
        : false;
      const effectiveRouteKey = applied && requestedRouteKey ? requestedRouteKey : fallbackRouteKey;
      if (!requestedRouteKey || !applied) {
        updateHashRoute(effectiveRouteKey, { replace: true });
      }
      setRouteKey(effectiveRouteKey);
      scrollToTopSafely();
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return;

    const previousDerived = previousDerivedRouteRef.current;
    previousDerivedRouteRef.current = derivedRouteKey;

    if (previousDerived === null) {
      const requestedRouteKey = parseHashRouteKey(window.location.hash);
      if (!requestedRouteKey) {
        updateHashRoute(derivedRouteKey, { replace: true });
        setRouteKey(derivedRouteKey);
      }
      return;
    }

    if (previousDerived === derivedRouteKey) return;

    const currentHashRouteKey = parseHashRouteKey(window.location.hash);
    if (currentHashRouteKey === derivedRouteKey) {
      setRouteKey(derivedRouteKey);
      return;
    }

    updateHashRoute(derivedRouteKey);
    setRouteKey(derivedRouteKey);
    scrollToTopSafely();
  }, [derivedRouteKey, isReady]);

  return {
    routeKey,
    derivedRouteKey,
  };
};
