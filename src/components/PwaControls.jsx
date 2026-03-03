import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, Bell, CloudUpload } from 'lucide-react';

const PwaControls = React.memo(function PwaControls({
  queuedWritesCount = 0,
  flushOfflineOutbox,
  showToast,
  mode = 'floating',
}) {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [pwaUpdateRegistration, setPwaUpdateRegistration] = useState(null);
  const [showPwaUpdate, setShowPwaUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  ));
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const detectStandalone = () => {
      const standalone = Boolean(
        window.matchMedia?.('(display-mode: standalone)')?.matches
        || window.navigator?.standalone === true
      );
      setIsStandaloneApp(standalone);
      if (standalone) {
        setDeferredInstallPrompt(null);
        setShowInstallPrompt(false);
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      detectStandalone();
      setDeferredInstallPrompt(event);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowInstallPrompt(false);
      detectStandalone();
    };

    detectStandalone();

    const displayModeMedia = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = () => detectStandalone();

    if (displayModeMedia?.addEventListener) {
      displayModeMedia.addEventListener('change', handleDisplayModeChange);
    } else if (displayModeMedia?.addListener) {
      displayModeMedia.addListener(handleDisplayModeChange);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (displayModeMedia?.removeEventListener) {
        displayModeMedia.removeEventListener('change', handleDisplayModeChange);
      } else if (displayModeMedia?.removeListener) {
        displayModeMedia.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const handleUpdateAvailable = (event) => {
      const registration = event?.detail?.registration || null;
      setPwaUpdateRegistration(registration);
      setShowPwaUpdate(true);
    };

    const handleSwUpdated = () => {
      setShowPwaUpdate(false);
      setPwaUpdateRegistration(null);
    };

    window.addEventListener('pwa:update-available', handleUpdateAvailable);
    window.addEventListener('pwa:sw-updated', handleSwUpdated);

    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).then((registration) => {
      if (registration?.waiting) {
        setPwaUpdateRegistration(registration);
        setShowPwaUpdate(true);
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener('pwa:update-available', handleUpdateAvailable);
      window.removeEventListener('pwa:sw-updated', handleSwUpdated);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    const refreshPermission = () => {
      const permission = Notification.permission;
      setNotificationPermission(permission);
      setShowNotificationPrompt(isStandaloneApp && permission === 'default');
    };

    refreshPermission();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshPermission();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isStandaloneApp]);

  const showSystemNotification = useCallback(async (title, options = {}) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    const iconUrl = `${import.meta.env.BASE_URL}pwa-192x192.png`;
    const baseOptions = {
      icon: iconUrl,
      badge: iconUrl,
      ...options,
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
        if (registration?.showNotification) {
          await registration.showNotification(title, baseOptions);
          return true;
        }
      } catch {
        // Fallback to window Notification below.
      }
    }

    const notification = new Notification(title, baseOptions);
    void notification;
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOutboxFlushed = (event) => {
      const flushedCount = Number(event?.detail?.flushedCount || 0);
      if (!Number.isFinite(flushedCount) || flushedCount <= 0) return;
      void showSystemNotification('Offline changes synced', {
        body: `${flushedCount} queued change${flushedCount === 1 ? '' : 's'} uploaded to cloud.`,
        tag: 'bfm-outbox-sync',
      });
    };

    window.addEventListener('bfm:outbox-flushed', handleOutboxFlushed);
    return () => {
      window.removeEventListener('bfm:outbox-flushed', handleOutboxFlushed);
    };
  }, [showSystemNotification]);

  const handleInstallPwa = async () => {
    if (isStandaloneApp) return;
    if (!deferredInstallPrompt) {
      showToast?.('Use browser menu and choose "Add to Home Screen"', 'error');
      return;
    }
    try {
      await deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result?.outcome === 'accepted') {
        showToast?.('Installing app...');
      } else {
        showToast?.('Install dismissed', 'error');
      }
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      showToast?.('Install prompt failed', 'error');
    } finally {
      setDeferredInstallPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleApplyPwaUpdate = async () => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      setShowPwaUpdate(false);
      return;
    }
    try {
      const registration = pwaUpdateRegistration || await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
      if (!registration) {
        setShowPwaUpdate(false);
        return;
      }
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        showToast?.('Updating app...');
        return;
      }

      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        showToast?.('Updating app...');
      } else {
        setShowPwaUpdate(false);
        showToast?.('App is already up to date');
      }
    } catch (error) {
      console.error('Failed to apply PWA update:', error);
      showToast?.('Update failed. Please refresh manually.', 'error');
    }
  };

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast?.('Notifications are not supported on this device', 'error');
      return;
    }
    if (!isStandaloneApp) {
      showToast?.('Install to Home Screen first, then enable notifications', 'error');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setShowNotificationPrompt(isStandaloneApp && permission === 'default');
      if (permission === 'granted') {
        showToast?.('Notifications enabled');
        await showSystemNotification('Badminton App notifications enabled', {
          body: 'You will receive sync updates for queued offline changes.',
          tag: 'bfm-notifications-enabled',
        });
        return;
      }
      if (permission === 'denied') {
        showToast?.('Notifications blocked in browser settings', 'error');
      } else {
        showToast?.('Notification prompt dismissed', 'error');
      }
    } catch (error) {
      console.error('Notification permission request failed:', error);
      showToast?.('Failed to enable notifications', 'error');
    }
  };

  const handleFlushQueuedWrites = async () => {
    if (typeof flushOfflineOutbox !== 'function') return;
    try {
      const summary = await flushOfflineOutbox();
      if (summary?.remainingCount > 0 && navigator.onLine) {
        showToast?.('Some queued changes still need retry', 'error');
      } else if (summary?.flushedCount === 0) {
        showToast?.('No queued changes pending');
      }
    } catch (error) {
      console.error('Failed to flush queued writes:', error);
      showToast?.('Failed to sync queued changes', 'error');
    }
  };

  if (mode === 'drawer') {
    const hasActionItems = (
      (showInstallPrompt && !isStandaloneApp)
      || (showNotificationPrompt && notificationPermission === 'default')
      || showPwaUpdate
      || queuedWritesCount > 0
      || isOffline
    );

    return (
      <div className="utility-drawer-section">
        {showInstallPrompt && !isStandaloneApp && (
          <button
            type="button"
            onClick={handleInstallPwa}
            className="utility-drawer-action"
            aria-label="Install app"
          >
            <Download size={17} />
            <span>Install App</span>
          </button>
        )}

        {showNotificationPrompt && notificationPermission === 'default' && (
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="utility-drawer-action"
            aria-label="Enable notifications"
          >
            <Bell size={17} />
            <span>Enable Alerts</span>
          </button>
        )}

        {showPwaUpdate && (
          <button
            type="button"
            onClick={handleApplyPwaUpdate}
            className="utility-drawer-action"
            aria-label="Apply app update"
          >
            <RefreshCw size={17} />
            <span>Update App</span>
          </button>
        )}

        {queuedWritesCount > 0 && (
          <button
            type="button"
            className="utility-drawer-action"
            onClick={handleFlushQueuedWrites}
            title="Sync queued offline changes now"
          >
            <CloudUpload size={17} />
            <span>{queuedWritesCount} pending sync</span>
          </button>
        )}

        {isOffline && (
          <div className="utility-drawer-status" role="status" aria-live="polite">
            <WifiOff size={16} />
            <span>Offline mode enabled</span>
          </div>
        )}

        {!hasActionItems && (
          <p className="utility-drawer-empty">No pending utility actions.</p>
        )}
      </div>
    );
  }

  return (
    <>
      {showInstallPrompt && !isStandaloneApp && (
        <button
          type="button"
          onClick={handleInstallPwa}
          className="pwa-install-btn"
          aria-label="Install app"
          title="Install app"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {showNotificationPrompt && notificationPermission === 'default' && (
        <button
          type="button"
          onClick={handleEnableNotifications}
          className="pwa-notify-btn"
          aria-label="Enable notifications"
          title="Enable notifications"
        >
          <Bell size={18} />
          <span className="hidden sm:inline">Enable Alerts</span>
        </button>
      )}

      {showPwaUpdate && (
        <div className="pwa-update-banner" role="status" aria-live="polite">
          <p className="pwa-update-title">New version available</p>
          <div className="pwa-update-actions">
            <button
              type="button"
              className="pwa-update-refresh-btn"
              onClick={handleApplyPwaUpdate}
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="pwa-update-dismiss-btn"
              onClick={() => setShowPwaUpdate(false)}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {queuedWritesCount > 0 && (
        <button
          type="button"
          className="pwa-sync-badge"
          onClick={handleFlushQueuedWrites}
          title="Sync queued offline changes now"
        >
          <CloudUpload size={15} />
          <span>{queuedWritesCount} pending sync</span>
        </button>
      )}

      {isOffline && (
        <div className="pwa-network-badge" role="status" aria-live="polite">
          <WifiOff size={15} />
          <span>Offline Mode</span>
        </div>
      )}
    </>
  );
});

export default PwaControls;
