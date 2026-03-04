import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const useTournamentViewState = ({
  tournamentFormat,
  onRefreshTournament,
}) => {
  const [activeTab, setActiveTab] = useState('fixtures');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const gestureStartRef = useRef({ x: 0, y: 0, active: false, swipeUsed: false, pullReady: false });
  const resetPullTimerRef = useRef(null);

  const swipeTabOrder = useMemo(() => {
    const order = ['fixtures'];
    if (tournamentFormat === 'league') {
      order.push('table', 'stats');
    }
    order.push('elo', 'final');
    return order;
  }, [tournamentFormat]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const bodyClass = 'has-mobile-command-bar';
    const syncBodyClass = () => {
      const isMobile = window.matchMedia
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth < 768;
      if (isMobile) {
        document.body.classList.add(bodyClass);
      } else {
        document.body.classList.remove(bodyClass);
      }
    };

    syncBodyClass();
    window.addEventListener('resize', syncBodyClass);
    return () => {
      window.removeEventListener('resize', syncBodyClass);
      document.body.classList.remove(bodyClass);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(media.matches);
    syncViewport();
    if (media.addEventListener) {
      media.addEventListener('change', syncViewport);
    } else {
      media.addListener(syncViewport);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', syncViewport);
      } else {
        media.removeListener(syncViewport);
      }
    };
  }, []);

  useEffect(() => () => {
    if (resetPullTimerRef.current) {
      clearTimeout(resetPullTimerRef.current);
      resetPullTimerRef.current = null;
    }
  }, []);

  const swipeToAdjacentTab = useCallback((direction) => {
    const currentIndex = swipeTabOrder.indexOf(activeTab);
    if (currentIndex < 0) return;
    const offset = direction === 'left' ? 1 : -1;
    const nextTab = swipeTabOrder[currentIndex + offset];
    if (nextTab) setActiveTab(nextTab);
  }, [activeTab, swipeTabOrder]);

  const triggerPullRefresh = useCallback(async () => {
    if (isPullRefreshing || typeof onRefreshTournament !== 'function') return;
    setIsPullRefreshing(true);
    setPullDistance(72);
    try {
      await Promise.resolve(onRefreshTournament());
    } finally {
      setIsPullRefreshing(false);
      if (resetPullTimerRef.current) {
        clearTimeout(resetPullTimerRef.current);
      }
      resetPullTimerRef.current = setTimeout(() => {
        setPullDistance(0);
        resetPullTimerRef.current = null;
      }, 180);
    }
  }, [isPullRefreshing, onRefreshTournament]);

  const handleContentTouchStart = useCallback((event) => {
    if (!isMobileViewport || isPullRefreshing) return;
    const target = event.target;
    const blockGesture = target?.closest?.(
      'input, textarea, select, button, [data-no-gesture], .overflow-x-auto, .scrollbar-thin'
    );
    if (blockGesture) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    gestureStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true,
      swipeUsed: false,
      pullReady: window.scrollY <= 0,
    };
  }, [isMobileViewport, isPullRefreshing]);

  const handleContentTouchMove = useCallback((event) => {
    const state = gestureStartRef.current;
    if (!state.active) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - state.x;
    const deltaY = touch.clientY - state.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!state.swipeUsed && absX > 52 && absX > absY + 12) {
      state.swipeUsed = true;
      swipeToAdjacentTab(deltaX < 0 ? 'left' : 'right');
      return;
    }

    if (!state.pullReady || deltaY <= 0 || absY < absX + 10) return;
    const nextPull = Math.min(96, Math.max(0, deltaY * 0.5));
    setPullDistance(nextPull);
    if (event.cancelable) {
      event.preventDefault();
    }
  }, [swipeToAdjacentTab]);

  const handleContentTouchEnd = useCallback(() => {
    const state = gestureStartRef.current;
    gestureStartRef.current = { x: 0, y: 0, active: false, swipeUsed: false, pullReady: false };
    if (!state.active || state.swipeUsed || pullDistance <= 0) {
      setPullDistance(0);
      return;
    }
    if (pullDistance >= 62) {
      void triggerPullRefresh();
      return;
    }
    setPullDistance(0);
  }, [pullDistance, triggerPullRefresh]);

  return {
    activeTab,
    setActiveTab,
    showHeaderMenu,
    setShowHeaderMenu,
    isMobileViewport,
    pullDistance,
    isPullRefreshing,
    handleContentTouchStart,
    handleContentTouchMove,
    handleContentTouchEnd,
  };
};
