import { listSports, resolveSportId } from '@fixture-maker/domain/sports';

export const APP_ROUTE_KEYS = Object.freeze({
  AUTH: 'auth',
  GROUPS: 'groups',
  GROUP_REQUESTS: 'group-requests',
  VIEWER: 'viewer',
  SPORT_HUB: 'sport-hub',
  SETUP: 'setup',
  TEAMS: 'teams',
  TOURNAMENT: 'tournament',
});

const VALID_SPORT_IDS = new Set(listSports().map((sport) => sport.id));

const STATIC_HASH_BY_ROUTE_KEY = Object.freeze({
  [APP_ROUTE_KEYS.AUTH]: '#/auth',
  [APP_ROUTE_KEYS.GROUPS]: '#/groups',
  [APP_ROUTE_KEYS.GROUP_REQUESTS]: '#/groups/requests',
  [APP_ROUTE_KEYS.VIEWER]: '#/viewer',
  [APP_ROUTE_KEYS.SPORT_HUB]: '#/sports',
});

const STATIC_ROUTE_KEY_BY_HASH = Object.freeze({
  '/auth': APP_ROUTE_KEYS.AUTH,
  '/groups': APP_ROUTE_KEYS.GROUPS,
  '/groups/requests': APP_ROUTE_KEYS.GROUP_REQUESTS,
  '/viewer': APP_ROUTE_KEYS.VIEWER,
  '/sports': APP_ROUTE_KEYS.SPORT_HUB,
  '/setup': APP_ROUTE_KEYS.SPORT_HUB,
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

const resolveSportIdFromPathSegment = (segment) => {
  const normalized = resolveSportId(String(segment || '').trim());
  return VALID_SPORT_IDS.has(normalized) ? normalized : null;
};

export const parseAppRoute = (hash = '') => {
  const path = normalizeHashPath(hash);
  if (!path) {
    return { routeKey: null, sportId: null };
  }

  const staticRoute = STATIC_ROUTE_KEY_BY_HASH[path];
  if (staticRoute) {
    return { routeKey: staticRoute, sportId: null };
  }

  const sportMatch = path.match(/^\/sports\/([^/]+)(?:\/(.+))?$/);
  if (sportMatch) {
    const sportId = resolveSportIdFromPathSegment(sportMatch[1]);
    if (!sportId) {
      return { routeKey: APP_ROUTE_KEYS.SPORT_HUB, sportId: null };
    }
    const subPath = sportMatch[2];
    if (!subPath) {
      return { routeKey: APP_ROUTE_KEYS.SETUP, sportId };
    }
    if (subPath === 'teams') {
      return { routeKey: APP_ROUTE_KEYS.TEAMS, sportId };
    }
    if (subPath === 'live') {
      return { routeKey: APP_ROUTE_KEYS.TOURNAMENT, sportId };
    }
    return { routeKey: APP_ROUTE_KEYS.SETUP, sportId };
  }

  if (path === '/teams') {
    return { routeKey: APP_ROUTE_KEYS.TEAMS, sportId: null };
  }
  if (path === '/live') {
    return { routeKey: APP_ROUTE_KEYS.TOURNAMENT, sportId: null };
  }

  return { routeKey: null, sportId: null };
};

/** @deprecated use parseAppRoute */
export const parseHashRouteKey = (hash = '') => parseAppRoute(hash).routeKey;

export const buildAppHash = (routeKey, { sportId = null } = {}) => {
  if (routeKey === APP_ROUTE_KEYS.SPORT_HUB) {
    return STATIC_HASH_BY_ROUTE_KEY[APP_ROUTE_KEYS.SPORT_HUB];
  }
  if (routeKey === APP_ROUTE_KEYS.SETUP) {
    return sportId ? `#/sports/${sportId}` : '#/sports';
  }
  if (routeKey === APP_ROUTE_KEYS.TEAMS) {
    return sportId ? `#/sports/${sportId}/teams` : '#/sports';
  }
  if (routeKey === APP_ROUTE_KEYS.TOURNAMENT) {
    return sportId ? `#/sports/${sportId}/live` : '#/sports';
  }
  return STATIC_HASH_BY_ROUTE_KEY[routeKey] || '#/sports';
};

export const getHashForRouteKey = (routeKey, options = {}) => (
  buildAppHash(routeKey, options)
);

export const isWorkspaceRouteKey = (routeKey) => (
  routeKey === APP_ROUTE_KEYS.SPORT_HUB
  || routeKey === APP_ROUTE_KEYS.SETUP
  || routeKey === APP_ROUTE_KEYS.TEAMS
  || routeKey === APP_ROUTE_KEYS.TOURNAMENT
);

export const deriveRouteKeyFromAppState = ({
  requiresAuth = false,
  groupsEnabled = true,
  currentUser = null,
  isGuestViewer = false,
  activeGroup = null,
  groupRole = null,
  showRequestCenter = false,
  isViewerMode = false,
  step = 'setup',
  sportHubActive = false,
} = {}) => {
  if (requiresAuth && !currentUser && !isGuestViewer) {
    return APP_ROUTE_KEYS.AUTH;
  }

  if (requiresAuth && groupsEnabled && groupRole === 'admin' && showRequestCenter && activeGroup) {
    return APP_ROUTE_KEYS.GROUP_REQUESTS;
  }

  if (requiresAuth && groupsEnabled && !activeGroup) {
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

  if (sportHubActive) {
    return APP_ROUTE_KEYS.SPORT_HUB;
  }

  return APP_ROUTE_KEYS.SETUP;
};
