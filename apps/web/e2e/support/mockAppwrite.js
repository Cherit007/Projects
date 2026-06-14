const buildCorsHeaders = async (request) => {
  const origin = (await request.headerValue('origin')) || 'http://127.0.0.1:4173';
  const requestedHeaders = (await request.headerValue('access-control-request-headers'))
    || 'content-type,x-appwrite-project,x-appwrite-response-format,x-fallback-cookies';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': requestedHeaders,
    'access-control-allow-credentials': 'true',
    vary: 'origin',
  };
};

const COLLECTIONS = {
  GROUPS: 'e2e_groups',
  GROUP_MEMBERS: 'e2e_group_members',
  GROUP_INVITES: 'e2e_group_invites',
  GROUP_JOIN_REQUESTS: 'e2e_group_join_requests',
  TOURNAMENTS: 'e2e_tournaments',
  TOURNAMENT_TEAMS: 'e2e_tournament_teams',
  MATCHES: 'e2e_matches',
  MATCH_PLAYERS: 'e2e_match_players',
  PLAYERS: 'e2e_players',
  RATINGS_CURRENT: 'e2e_ratings_current',
};
const MOCK_DEBUG = process.env.E2E_APPWRITE_MOCK_DEBUG === '1';

export const E2E_AUTH = {
  admin: {
    id: 'user-admin',
    name: 'Admin Player',
    email: 'admin@smoke.local',
    password: 'Password123!',
  },
  member: {
    id: 'user-member',
    name: 'Member Player',
    email: 'member@smoke.local',
    password: 'Password123!',
  },
  group: {
    id: 'group-e2e-main',
    name: 'E2E Badminton Club',
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

const normalizeComparable = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildErrorPayload = (status, message, type = 'general_unknown') => ({
  message,
  code: status,
  type,
});

const toDoc = ({
  id,
  databaseId,
  collectionId,
  data = {},
  createdAt = nowIso(),
}) => ({
  ...clone(data),
  $id: id,
  $databaseId: databaseId,
  $collectionId: collectionId,
  $createdAt: createdAt,
  $updatedAt: nowIso(),
  $permissions: [],
});

const parseBody = (request) => {
  try {
    return request.postDataJSON?.() || {};
  } catch (_error) {
    try {
      const raw = request.postData();
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
};

const parseQueryDescriptors = (url) => {
  const descriptors = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'queries' || key.startsWith('queries[')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          descriptors.push(parsed);
        }
      } catch {
        // ignore malformed descriptors
      }
    }
  }
  return descriptors;
};

const pickComparable = (doc, attribute) => {
  if (!attribute) return '';
  if (attribute in doc) return normalizeComparable(doc[attribute]);
  return '';
};

const applyListQueries = (documents, descriptors = []) => {
  const rows = Array.isArray(documents) ? [...documents] : [];
  let filtered = rows;
  let order = null;
  let cursorAfter = '';
  let cursorBefore = '';
  let limit = null;

  descriptors.forEach((query) => {
    const method = String(query?.method || '').trim();
    if (!method) return;

    if (method === 'equal') {
      const attribute = String(query?.attribute || '').trim();
      const values = Array.isArray(query?.values) ? query.values : [];
      const normalizedValues = new Set(values.map((value) => normalizeComparable(value)));
      filtered = filtered.filter((doc) => normalizedValues.has(pickComparable(doc, attribute)));
      return;
    }

    if (method === 'orderAsc' || method === 'orderDesc') {
      order = {
        attribute: String(query?.attribute || '').trim(),
        desc: method === 'orderDesc',
      };
      return;
    }

    if (method === 'cursorAfter') {
      cursorAfter = normalizeComparable(Array.isArray(query?.values) ? query.values[0] : '');
      return;
    }

    if (method === 'cursorBefore') {
      cursorBefore = normalizeComparable(Array.isArray(query?.values) ? query.values[0] : '');
      return;
    }

    if (method === 'limit') {
      const maybeLimit = Number(Array.isArray(query?.values) ? query.values[0] : null);
      if (Number.isFinite(maybeLimit) && maybeLimit >= 0) {
        limit = maybeLimit;
      }
    }
  });

  if (order?.attribute) {
    const { attribute, desc } = order;
    filtered.sort((left, right) => {
      const leftValue = pickComparable(left, attribute);
      const rightValue = pickComparable(right, attribute);
      if (leftValue === rightValue) return 0;
      if (leftValue > rightValue) return desc ? -1 : 1;
      return desc ? 1 : -1;
    });
  }

  if (cursorAfter) {
    const index = filtered.findIndex((doc) => normalizeComparable(doc?.$id) === cursorAfter);
    if (index >= 0) filtered = filtered.slice(index + 1);
  }

  if (cursorBefore) {
    const index = filtered.findIndex((doc) => normalizeComparable(doc?.$id) === cursorBefore);
    if (index >= 0) filtered = filtered.slice(0, index);
  }

  const total = filtered.length;
  if (Number.isFinite(limit)) {
    filtered = filtered.slice(0, limit);
  }

  return {
    total,
    documents: filtered,
  };
};

const createInitialState = () => {
  const databaseId = 'e2e-db';
  const usersById = new Map();
  const usersByEmail = new Map();
  const collections = new Map();
  let generatedDocCounter = 0;
  let generatedSessionCounter = 0;
  let generatedUserCounter = 0;
  let currentSessionUserId = null;

  const insertUser = (user) => {
    const normalized = {
      ...user,
      $createdAt: user.$createdAt || nowIso(),
      $updatedAt: user.$updatedAt || nowIso(),
    };
    usersById.set(normalized.$id, normalized);
    usersByEmail.set(String(normalized.email || '').toLowerCase(), normalized);
  };

  insertUser({
    $id: E2E_AUTH.admin.id,
    name: E2E_AUTH.admin.name,
    email: E2E_AUTH.admin.email,
    password: E2E_AUTH.admin.password,
  });
  insertUser({
    $id: E2E_AUTH.member.id,
    name: E2E_AUTH.member.name,
    email: E2E_AUTH.member.email,
    password: E2E_AUTH.member.password,
  });

  const ensureCollection = (collectionId) => {
    if (!collections.has(collectionId)) {
      collections.set(collectionId, new Map());
    }
    return collections.get(collectionId);
  };

  const seedDoc = (collectionId, id, data) => {
    const collection = ensureCollection(collectionId);
    collection.set(
      id,
      toDoc({
        id,
        databaseId,
        collectionId,
        data,
      })
    );
  };

  seedDoc(COLLECTIONS.GROUPS, E2E_AUTH.group.id, {
    name: E2E_AUTH.group.name,
    creatorId: E2E_AUTH.admin.id,
    createdAt: nowIso(),
  });

  seedDoc(COLLECTIONS.GROUP_MEMBERS, 'gm-admin', {
    groupId: E2E_AUTH.group.id,
    userId: E2E_AUTH.admin.id,
    role: 'admin',
    email: E2E_AUTH.admin.email,
    name: E2E_AUTH.admin.name,
    joinedAt: nowIso(),
    invitedBy: E2E_AUTH.admin.id,
  });
  seedDoc(COLLECTIONS.GROUP_MEMBERS, 'gm-member', {
    groupId: E2E_AUTH.group.id,
    userId: E2E_AUTH.member.id,
    role: 'member',
    email: E2E_AUTH.member.email,
    name: E2E_AUTH.member.name,
    joinedAt: nowIso(),
    invitedBy: E2E_AUTH.admin.id,
  });

  const nextDocId = () => {
    generatedDocCounter += 1;
    return `doc-${generatedDocCounter}`;
  };

  const nextUserId = () => {
    generatedUserCounter += 1;
    return `user-generated-${generatedUserCounter}`;
  };

  const nextSessionId = () => {
    generatedSessionCounter += 1;
    return `sess-${generatedSessionCounter}`;
  };

  const sanitizeUser = (user) => ({
    $id: user.$id,
    name: user.name || '',
    email: user.email || '',
    $createdAt: user.$createdAt,
    $updatedAt: nowIso(),
  });

  const fulfillJson = async (route, request, status, payload, extraHeaders = {}) => {
    const corsHeaders = await buildCorsHeaders(request);
    await route.fulfill({
      status,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  };

  const fulfillError = async (route, request, status, message, type = 'general_unknown') => {
    await fulfillJson(route, request, status, buildErrorPayload(status, message, type));
  };

  const handleAccountRoutes = async (route, method, path, requestBody, request) => {
    if (method === 'GET' && path === '/v1/account') {
      if (!currentSessionUserId || !usersById.has(currentSessionUserId)) {
        await fulfillError(route, request, 401, 'User is not authenticated', 'user_unauthorized');
        return true;
      }
      await fulfillJson(route, request, 200, sanitizeUser(usersById.get(currentSessionUserId)));
      return true;
    }

    if (method === 'POST' && path === '/v1/account') {
      const email = String(requestBody?.email || '').trim().toLowerCase();
      const password = String(requestBody?.password || '');
      if (!email || !password) {
        await fulfillError(route, request, 400, 'Email and password are required', 'user_invalid_credentials');
        return true;
      }
      if (usersByEmail.has(email)) {
        await fulfillError(route, request, 409, 'Email already exists', 'user_already_exists');
        return true;
      }

      const requestedUserId = String(requestBody?.userId || '').trim();
      const userId = requestedUserId && requestedUserId !== 'unique()' ? requestedUserId : nextUserId();
      const user = {
        $id: userId,
        name: String(requestBody?.name || '').trim(),
        email,
        password,
        $createdAt: nowIso(),
        $updatedAt: nowIso(),
      };
      insertUser(user);
      await fulfillJson(route, request, 201, sanitizeUser(user));
      return true;
    }

    if (method === 'POST' && path === '/v1/account/sessions/email') {
      const email = String(requestBody?.email || '').trim().toLowerCase();
      const password = String(requestBody?.password || '');
      const user = usersByEmail.get(email);
      if (!user || user.password !== password) {
        await fulfillError(route, request, 401, 'Invalid credentials', 'user_invalid_credentials');
        return true;
      }
      currentSessionUserId = user.$id;
      await fulfillJson(route, request, 201, {
        $id: nextSessionId(),
        userId: user.$id,
        provider: 'email',
        providerUid: user.$id,
        expire: new Date(Date.now() + (1000 * 60 * 60 * 24)).toISOString(),
      });
      return true;
    }

    if (method === 'DELETE' && path === '/v1/account/sessions/current') {
      currentSessionUserId = null;
      await fulfillJson(route, request, 204, {});
      return true;
    }

    if (method === 'PATCH' && path === '/v1/account/name') {
      if (!currentSessionUserId || !usersById.has(currentSessionUserId)) {
        await fulfillError(route, request, 401, 'User is not authenticated', 'user_unauthorized');
        return true;
      }
      const nextName = String(requestBody?.name || '').trim();
      const user = usersById.get(currentSessionUserId);
      user.name = nextName || user.name;
      user.$updatedAt = nowIso();
      usersById.set(user.$id, user);
      usersByEmail.set(String(user.email || '').toLowerCase(), user);
      await fulfillJson(route, request, 200, sanitizeUser(user));
      return true;
    }

    return false;
  };

  const handleDocumentRoutes = async (route, method, path, url, requestBody, request) => {
    const segments = path.split('/').filter(Boolean);
    if (
      segments.length < 6
      || segments[0] !== 'v1'
      || segments[1] !== 'databases'
      || segments[3] !== 'collections'
      || segments[5] !== 'documents'
    ) {
      return false;
    }

    const databaseInPath = decodeURIComponent(segments[2] || '');
    const collectionId = decodeURIComponent(segments[4] || '');
    const collection = ensureCollection(collectionId);

    if (segments.length === 6) {
      if (method === 'GET') {
        const descriptors = parseQueryDescriptors(url);
        const listed = applyListQueries(Array.from(collection.values()), descriptors);
        await fulfillJson(route, request, 200, {
          total: listed.total,
          documents: listed.documents.map((doc) => clone(doc)),
        });
        return true;
      }

      if (method === 'POST') {
        const requested = String(requestBody?.documentId || '').trim();
        const documentId = requested && requested !== 'unique()' ? requested : nextDocId();
        if (collection.has(documentId)) {
          await fulfillError(route, request, 409, 'Document already exists', 'document_already_exists');
          return true;
        }
        const created = toDoc({
          id: documentId,
          databaseId: databaseInPath,
          collectionId,
          data: requestBody?.data || {},
        });
        collection.set(documentId, created);
        await fulfillJson(route, request, 201, clone(created));
        return true;
      }

      return false;
    }

    if (segments.length === 7) {
      const documentId = decodeURIComponent(segments[6] || '');
      const existing = collection.get(documentId) || null;

      if (method === 'GET') {
        if (!existing) {
          await fulfillError(route, request, 404, 'Document not found', 'document_not_found');
          return true;
        }
        await fulfillJson(route, request, 200, clone(existing));
        return true;
      }

      if (method === 'DELETE') {
        if (!existing) {
          await fulfillError(route, request, 404, 'Document not found', 'document_not_found');
          return true;
        }
        collection.delete(documentId);
        await fulfillJson(route, request, 204, {});
        return true;
      }

      if (method === 'PATCH' || method === 'PUT') {
        const incomingData = requestBody?.data && typeof requestBody.data === 'object'
          ? requestBody.data
          : {};

        const mergedData = method === 'PATCH'
          ? { ...(existing || {}), ...incomingData }
          : { ...(existing || {}), ...incomingData };

        const updated = toDoc({
          id: documentId,
          databaseId: databaseInPath,
          collectionId,
          data: mergedData,
          createdAt: existing?.$createdAt || nowIso(),
        });
        collection.set(documentId, updated);
        await fulfillJson(route, request, existing ? 200 : 201, clone(updated));
        return true;
      }
    }

    return false;
  };

  return {
    async handler(route) {
      const request = route.request();
      const method = request.method().toUpperCase();
      const url = new URL(request.url());
      const path = url.pathname.replace(/\/+$/, '');
      const requestBody = parseBody(request);

      if (MOCK_DEBUG) {
        const origin = await request.headerValue('origin');
        // eslint-disable-next-line no-console
        console.log(
          `[e2e-appwrite-mock] ${method} ${path} origin=${origin || 'none'}`
        );
      }

      if (method === 'OPTIONS') {
        const corsHeaders = await buildCorsHeaders(request);
        await route.fulfill({
          status: 204,
          headers: {
            ...corsHeaders,
          },
          body: '',
        });
        return;
      }

      if (!path.startsWith('/v1/')) {
        await route.fallback();
        return;
      }

      try {
        if (await handleAccountRoutes(route, method, path, requestBody, request)) return;
        if (await handleDocumentRoutes(route, method, path, url, requestBody, request)) return;

        if (MOCK_DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(`[e2e-appwrite-mock] unhandled ${method} ${path}`);
        }
        await fulfillError(route, request, 404, `Unhandled mock route: ${method} ${path}`, 'route_not_found');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[e2e-appwrite-mock] handler failure', error);
        await fulfillError(
          route,
          request,
          500,
          `Mock route failure: ${String(error?.message || error)}`,
          'mock_runtime_error'
        );
      }
    },
  };
};

export const installMockAppwrite = async (page) => {
  const state = createInitialState();
  await page.route('**/v1/**', async (route) => {
    await state.handler(route);
  });
};
