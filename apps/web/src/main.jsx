import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { queryClient } from './queryClient'
import { restoreQueryCache, startQueryCachePersistence } from './queryPersistence'

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
};

const bootstrap = async () => {
  if (typeof window !== 'undefined') {
    await restoreQueryCache(queryClient);
    startQueryCachePersistence(queryClient);
  }

  renderApp();
};

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    let updatePollTimerId = null;
    const emitUpdateAvailable = (registration) => {
      window.dispatchEvent(new CustomEvent('pwa:update-available', {
        detail: { registration },
      }));
    };

    const runUpdateCheck = (registration) => {
      if (!registration) return;
      registration.update().catch(() => {
        // Ignore background update check failures.
      });
    };

    navigator.serviceWorker.register(swUrl, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
      .then((registration) => {
        if (registration.waiting) {
          emitUpdateAvailable(registration);
        }

        runUpdateCheck(registration);

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              emitUpdateAvailable(registration);
            }
          });
        });

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            runUpdateCheck(registration);
          }
        };
        const handleFocus = () => {
          runUpdateCheck(registration);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        updatePollTimerId = window.setInterval(() => {
          runUpdateCheck(registration);
        }, 60 * 1000);

        // Cleanup listeners on full page unload.
        window.addEventListener('beforeunload', () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleFocus);
          if (updatePollTimerId !== null) {
            clearInterval(updatePollTimerId);
            updatePollTimerId = null;
          }
        }, { once: true });
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.dispatchEvent(new CustomEvent('pwa:sw-updated'));
      window.location.reload();
    });
  });
}

void bootstrap();
