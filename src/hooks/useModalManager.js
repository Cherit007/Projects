import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const INITIAL_MODAL_STATE = {
  showCasualMatch: false,
  showHistory: false,
  showCasualHistory: false,
  showAllTimeStats: false,
  showEloLeaderboard: false,
  mobileSetupView: 'home',
  pendingLinkPrompt: null,
  showProfileModal: false,
  showUtilityDrawer: false,
  confirmDialog: null,
};

export const useModalManager = () => {
  const [modalState, setModalState] = useState(INITIAL_MODAL_STATE);
  const confirmResolverRef = useRef(null);
  const confirmPromiseRef = useRef(null);

  const setModalValue = useCallback((key, nextValue) => {
    setModalState((prev) => ({
      ...prev,
      [key]: typeof nextValue === 'function' ? nextValue(prev[key]) : nextValue,
    }));
  }, []);

  const setShowCasualMatch = useCallback((value) => {
    setModalValue('showCasualMatch', value);
  }, [setModalValue]);
  const setShowHistory = useCallback((value) => {
    setModalValue('showHistory', value);
  }, [setModalValue]);
  const setShowCasualHistory = useCallback((value) => {
    setModalValue('showCasualHistory', value);
  }, [setModalValue]);
  const setShowAllTimeStats = useCallback((value) => {
    setModalValue('showAllTimeStats', value);
  }, [setModalValue]);
  const setShowEloLeaderboard = useCallback((value) => {
    setModalValue('showEloLeaderboard', value);
  }, [setModalValue]);
  const setMobileSetupView = useCallback((value) => {
    setModalValue('mobileSetupView', value);
  }, [setModalValue]);
  const setPendingLinkPrompt = useCallback((value) => {
    setModalValue('pendingLinkPrompt', value);
  }, [setModalValue]);
  const setShowProfileModal = useCallback((value) => {
    setModalValue('showProfileModal', value);
  }, [setModalValue]);
  const setShowUtilityDrawer = useCallback((value) => {
    setModalValue('showUtilityDrawer', value);
  }, [setModalValue]);

  const resolveConfirmDialog = useCallback((confirmed) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setModalValue('confirmDialog', null);
    if (typeof resolver === 'function') {
      resolver(Boolean(confirmed));
    }
  }, [setModalValue]);

  const requestConfirmAction = useCallback((options = {}) => (
    (confirmPromiseRef.current
      || (() => {
        const promise = new Promise((resolve) => {
          const normalized = typeof options === 'string' ? { message: options } : (options || {});
          confirmResolverRef.current = resolve;
          setModalValue('confirmDialog', {
            title: normalized.title || 'Confirm Action',
            message: normalized.message || 'Are you sure?',
            confirmLabel: normalized.confirmLabel || 'Confirm',
            cancelLabel: normalized.cancelLabel || 'Cancel',
            tone: normalized.tone || 'danger',
          });
        }).finally(() => {
          confirmPromiseRef.current = null;
        });
        confirmPromiseRef.current = promise;
        return promise;
      })())
  ), [setModalValue]);

  useEffect(() => () => {
    if (typeof confirmResolverRef.current === 'function') {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    confirmPromiseRef.current = null;
  }, []);

  const setupModals = useMemo(() => ({
    showHistory: modalState.showHistory,
    setShowHistory,
    showCasualHistory: modalState.showCasualHistory,
    setShowCasualHistory,
    showAllTimeStats: modalState.showAllTimeStats,
    setShowAllTimeStats,
    showEloLeaderboard: modalState.showEloLeaderboard,
    setShowEloLeaderboard,
    mobileSetupView: modalState.mobileSetupView,
    setMobileSetupView,
  }), [
    modalState.showHistory,
    modalState.showCasualHistory,
    modalState.showAllTimeStats,
    modalState.showEloLeaderboard,
    modalState.mobileSetupView,
    setShowHistory,
    setShowCasualHistory,
    setShowAllTimeStats,
    setShowEloLeaderboard,
    setMobileSetupView,
  ]);

  return {
    showCasualMatch: modalState.showCasualMatch,
    setShowCasualMatch,
    showHistory: modalState.showHistory,
    setShowHistory,
    showCasualHistory: modalState.showCasualHistory,
    setShowCasualHistory,
    showAllTimeStats: modalState.showAllTimeStats,
    setShowAllTimeStats,
    showEloLeaderboard: modalState.showEloLeaderboard,
    setShowEloLeaderboard,
    mobileSetupView: modalState.mobileSetupView,
    setMobileSetupView,
    pendingLinkPrompt: modalState.pendingLinkPrompt,
    setPendingLinkPrompt,
    showProfileModal: modalState.showProfileModal,
    setShowProfileModal,
    showUtilityDrawer: modalState.showUtilityDrawer,
    setShowUtilityDrawer,
    confirmDialog: modalState.confirmDialog,
    requestConfirmAction,
    resolveConfirmDialog,
    setupModals,
  };
};
