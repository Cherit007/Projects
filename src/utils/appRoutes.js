export const APP_ROUTE_KEYS = Object.freeze({
  AUTH: 'auth',
  GROUPS: 'groups',
  GROUP_REQUESTS: 'group-requests',
  VIEWER: 'viewer',
  SETUP: 'setup',
  TEAMS: 'teams',
  TOURNAMENT: 'tournament',
});

const HASH_BY_ROUTE_KEY = Object.freeze({
  [APP_ROUTE_KEYS.AUTH]: '#/auth',
  [APP_ROUTE_KEYS.GROUPS]: '#/groups',
  [APP_ROUTE_KEYS.GROUP_REQUESTS]: '#/groups/requests',
  [APP_ROUTE_KEYS.VIEWER]: '#/viewer',
  [APP_ROUTE_KEYS.SETUP]: '#/setup',
  [APP_ROUTE_KEYS.TEAMS]: '#/teams',
  [APP_ROUTE_KEYS.TOURNAMENT]: '#/live',
});

const ROUTE_KEY_BY_HASH = Object.freeze({
  '/auth': APP_ROUTE_KEYS.AUTH,
  '/groups': APP_ROUTE_KEYS.GROUPS,
  '/groups/requests': APP_ROUTE_KEYS.GROUP_REQUESTS,
  '/viewer': APP_ROUTE_KEYS.VIEWER,
  '/setup': APP_ROUTE_KEYS.SETUP,
  '/teams': APP_ROUTE_KEYS.TEAMS,
  '/live': APP_ROUTE_KEYS.TOURNAMENT,
});

const normalizeHashPath = (hash = '') => {
  const raw = String(hash || '').trim();
  if (!raw) return '';
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const withoutQuery = withoutHash.split('?')[0] || '';
  const withoutTrailingSlash = withoutQuery.replace(/\/+$/, '');
  if (!withoutTrailingSlash) return '';
  return withoutTrailingSlash.startsWith('/') ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
};

export const parseHashRouteKey = (hash = '') => ROUTE_KEY_BY_HASH[normalizeHashPath(hash)] || null;

export const getHashForRouteKey = (routeKey) => (
  HASH_BY_ROUTE_KEY[routeKey] || HASH_BY_ROUTE_KEY[APP_ROUTE_KEYS.SETUP]
);

export const isWorkspaceRouteKey = (routeKey) => (
  routeKey === APP_ROUTE_KEYS.SETUP
  || routeKey === APP_ROUTE_KEYS.TEAMS
  || routeKey === APP_ROUTE_KEYS.TOURNAMENT
);

export const deriveRouteKeyFromAppState = ({
  requiresAuth = false,
  currentUser = null,
  isGuestViewer = false,
  activeGroup = null,
  groupRole = null,
  showRequestCenter = false,
  isViewerMode = false,
  step = 'setup',
} = {}) => {
  if (requiresAuth && !currentUser && !isGuestViewer) {
    return APP_ROUTE_KEYS.AUTH;
  }

  if (requiresAuth && groupRole === 'admin' && showRequestCenter && activeGroup) {
    return APP_ROUTE_KEYS.GROUP_REQUESTS;
  }

  if (requiresAuth && !activeGroup) {
    return APP_ROUTE_KEYS.GROUPS;
  }

  if (isViewerMode) {
    return APP_ROUTE_KEYS.VIEWER;
  }

  if (step === 'teams') {
    return APP_ROUTE_KEYS.TEAMS;
  }

  if (step === 'tournament') {
    return APP_ROUTE_KEYS.TOURNAMENT;
  }

  return APP_ROUTE_KEYS.SETUP;
};
