import { useCallback } from 'react';

export const useMobileShellActions = ({
  step = 'setup',
  showRequestCenter = false,
  requiresAuth = false,
  currentUser = null,
  assertCanOperate = () => true,
  handleHeaderGoHome,
  handleOpenHistoryModal,
  setMobileSetupView,
  setShowHistory,
  setShowCasualHistory,
  setShowAllTimeStats,
  setShowEloLeaderboard,
  setShowCasualMatch,
  setShowUtilityDrawer,
  setShowProfileModal,
}) => {
  const handleMobileGoHome = useCallback(() => {
    setMobileSetupView('home');
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    setShowCasualMatch(false);
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
  }, [
    handleHeaderGoHome,
    setMobileSetupView,
    setShowAllTimeStats,
    setShowCasualHistory,
    setShowCasualMatch,
    setShowEloLeaderboard,
    setShowHistory,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
  ]);

  const handleMobileOpenProfile = useCallback(() => {
    setShowUtilityDrawer(false);
    if (!requiresAuth || !currentUser) return;
    setShowProfileModal(true);
  }, [currentUser, requiresAuth, setShowProfileModal, setShowUtilityDrawer]);

  const handleMobileRecordCasual = useCallback(() => {
    setShowUtilityDrawer(false);
    if (!assertCanOperate()) return;
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setShowCasualMatch(true);
  }, [
    assertCanOperate,
    handleHeaderGoHome,
    setShowCasualMatch,
    setShowUtilityDrawer,
    showRequestCenter,
    step,
  ]);

  const handleMobileGoLive = useCallback(async () => {
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
  ]);

  const handleMobileOpenHistory = useCallback(() => {
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    void handleOpenHistoryModal();
  }, [handleHeaderGoHome, handleOpenHistoryModal, setShowUtilityDrawer, showRequestCenter, step]);

  const handleMobileOpenStats = useCallback(() => {
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
  ]);

  const handleMobileOpenCreate = useCallback(() => {
    setShowUtilityDrawer(false);
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setMobileSetupView('create');
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
  ]);

  return {
    handleMobileGoHome,
    handleMobileOpenProfile,
    handleMobileRecordCasual,
    handleMobileGoLive,
    handleMobileOpenHistory,
    handleMobileOpenStats,
    handleMobileOpenCreate,
  };
};
