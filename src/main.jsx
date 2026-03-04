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
    const emitUpdateAvailable = (registration) => {
      window.dispatchEvent(new CustomEvent('pwa:update-available', {
        detail: { registration },
      }));
    };

    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        if (registration.waiting) {
          emitUpdateAvailable(registration);
        }

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              emitUpdateAvailable(registration);
            }
          });
        });
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
