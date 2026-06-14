import { useCallback } from 'react';

export const useMobileShellActions = ({
  step = 'setup',
  showRequestCenter = false,
  requiresAuth = false,
  currentUser = null,
  assertCanOperate = () => true,
  handleHeaderGoHome,
  openSportHub,
  handleOpenHistoryModal,
  setMobileSetupView,
  setShowHistory,
  setShowCasualHistory,
  setShowAllTimeStats,
  setShowEloLeaderboard,
  setShowCasualMatch,
  setShowUtilityDrawer,
  setShowProfileModal,
  onRequestMobileScrollReset = () => {},
}) => {
  const handleMobileGoHome = useCallback(() => {
    onRequestMobileScrollReset();
    setMobileSetupView('home');
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    setShowCasualMatch(false);
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
      return;
    }
    openSportHub?.();
  }, [
    handleHeaderGoHome,
    openSportHub,
    setMobileSetupView,
    setShowAllTimeStats,
    setShowCasualHistory,
    setShowCasualMatch,
    setShowEloLeaderboard,
    setShowHistory,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
    onRequestMobileScrollReset,
  ]);

  const handleMobileOpenProfile = useCallback(() => {
    onRequestMobileScrollReset();
    setShowUtilityDrawer(false);
    if (!requiresAuth || !currentUser) return;
    setShowProfileModal(true);
  }, [currentUser, onRequestMobileScrollReset, requiresAuth, setShowProfileModal, setShowUtilityDrawer]);

  const handleMobileOpenStart = useCallback(() => {
    onRequestMobileScrollReset();
    setShowUtilityDrawer(false);
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setMobileSetupView('start');
  }, [
    handleHeaderGoHome,
    setMobileSetupView,
    setShowAllTimeStats,
    setShowCasualHistory,
    setShowEloLeaderboard,
    setShowHistory,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
    onRequestMobileScrollReset,
  ]);

  const handleMobileGoLive = useCallback(async () => {
    onRequestMobileScrollReset();
    setShowUtilityDrawer(false);
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    if (step === 'tournament') return;
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setMobileSetupView('live');
  }, [
    handleHeaderGoHome,
    setMobileSetupView,
    setShowAllTimeStats,
    setShowCasualHistory,
    setShowEloLeaderboard,
    setShowHistory,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
    onRequestMobileScrollReset,
  ]);

  const handleMobileOpenHistory = useCallback(() => {
    onRequestMobileScrollReset();
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    void handleOpenHistoryModal();
  }, [handleHeaderGoHome, handleOpenHistoryModal, onRequestMobileScrollReset, setShowUtilityDrawer, showRequestCenter, step]);

  const handleMobileOpenStats = useCallback(() => {
    onRequestMobileScrollReset();
    setShowUtilityDrawer(false);
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setMobileSetupView('stats');
  }, [
    handleHeaderGoHome,
    setMobileSetupView,
    setShowAllTimeStats,
    setShowCasualHistory,
    setShowEloLeaderboard,
    setShowHistory,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
    onRequestMobileScrollReset,
  ]);

  return {
    handleMobileGoHome,
    handleMobileOpenProfile,
    handleMobileGoLive,
    handleMobileOpenHistory,
    handleMobileOpenStats,
    handleMobileOpenStart,
  };
};
