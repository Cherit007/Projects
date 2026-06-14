import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const PwaUpdatePrompt = React.memo(function PwaUpdatePrompt({ showToast }) {
  const [registration, setRegistration] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const handleUpdateAvailable = (event) => {
      setRegistration(event?.detail?.registration || null);
      setVisible(true);
    };

    const handleSwUpdated = () => {
      setVisible(false);
      setRegistration(null);
    };

    window.addEventListener('pwa:update-available', handleUpdateAvailable);
    window.addEventListener('pwa:sw-updated', handleSwUpdated);

    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).then((existingRegistration) => {
      if (existingRegistration?.waiting) {
        setRegistration(existingRegistration);
        setVisible(true);
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener('pwa:update-available', handleUpdateAvailable);
      window.removeEventListener('pwa:sw-updated', handleSwUpdated);
    };
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      setVisible(false);
      return;
    }

    try {
      const targetRegistration = registration || await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
      if (!targetRegistration) {
        setVisible(false);
        return;
      }

      if (targetRegistration.waiting) {
        targetRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        showToast?.('Updating app...');
        return;
      }

      await targetRegistration.update();
      if (targetRegistration.waiting) {
        targetRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        showToast?.('Updating app...');
      } else {
        showToast?.('App is already up to date');
        setVisible(false);
      }
    } catch (error) {
      console.error('Failed to apply PWA update:', error);
      showToast?.('Update failed. Please refresh manually.', 'error');
    }
  }, [registration, showToast]);

  if (!visible) return null;

  return (
    <div className="pwa-update-banner pwa-global-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-title">New version available</p>
      <div className="pwa-update-actions">
        <button
          type="button"
          className="pwa-update-refresh-btn"
          onClick={handleApplyUpdate}
        >
          <RefreshCw size={15} />
          <span>Reload</span>
        </button>
        <button
          type="button"
          className="pwa-update-dismiss-btn"
          onClick={() => setVisible(false)}
        >
          Later
        </button>
      </div>
    </div>
  );
});

export default PwaUpdatePrompt;
