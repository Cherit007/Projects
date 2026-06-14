import { QueryClient } from '@tanstack/react-query';

const ONE_MINUTE_MS = 60 * 1000;

const toStatusCode = (error) => {
  const numeric = Number(error?.code ?? error?.status);
  return Number.isFinite(numeric) ? numeric : null;
};

const shouldRetryQuery = (failureCount, error) => {
  const statusCode = toStatusCode(error);
  // Don't retry client-side validation/auth/permission errors.
  if (statusCode !== null && statusCode >= 400 && statusCode < 500) return false;
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45 * 1000,
      gcTime: 30 * ONE_MINUTE_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});

// Bootstrap payload changes rarely; keep warm longer.
queryClient.setQueryDefaults(['appwrite', 'bootstrap'], {
  staleTime: 10 * ONE_MINUTE_MS,
  gcTime: 120 * ONE_MINUTE_MS,
});

// Home dashboard summary cards.
queryClient.setQueryDefaults(['tournaments', 'summaries'], {
  staleTime: 30 * 1000,
  gcTime: 30 * ONE_MINUTE_MS,
});

// History views can tolerate longer staleness.
queryClient.setQueryDefaults(['tournaments', 'history'], {
  staleTime: 5 * ONE_MINUTE_MS,
  gcTime: 60 * ONE_MINUTE_MS,
});

// Detail used while viewing live/edit state.
queryClient.setQueryDefaults(['tournaments', 'detail'], {
  staleTime: 2 * ONE_MINUTE_MS,
  gcTime: 30 * ONE_MINUTE_MS,
});

queryClient.setQueryDefaults(['casual-matches'], {
  staleTime: 3 * ONE_MINUTE_MS,
  gcTime: 45 * ONE_MINUTE_MS,
});

queryClient.setQueryDefaults(['groups'], {
  staleTime: 30 * 1000,
  gcTime: 20 * ONE_MINUTE_MS,
});
