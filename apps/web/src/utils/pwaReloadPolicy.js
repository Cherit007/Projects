const POLICY_KEY = '__BFM_PWA_RELOAD_POLICY__';

const getDefaultPolicy = () => ({
  approved: false,
  canAutoReload: true,
  pendingReload: false,
});

const getPolicyHost = () => (
  typeof window !== 'undefined' ? window : globalThis
);

export const readPwaReloadPolicy = () => {
  const host = getPolicyHost();
  if (!host[POLICY_KEY] || typeof host[POLICY_KEY] !== 'object') {
    host[POLICY_KEY] = getDefaultPolicy();
  }
  return host[POLICY_KEY];
};

export const markPwaReloadApproved = () => {
  const policy = readPwaReloadPolicy();
  policy.approved = true;
  return { ...policy };
};

export const resetPwaReloadApproval = () => {
  const policy = readPwaReloadPolicy();
  policy.approved = false;
  return { ...policy };
};

export const setPwaAutoReloadAllowed = (allowed) => {
  const policy = readPwaReloadPolicy();
  policy.canAutoReload = Boolean(allowed);
  return { ...policy };
};

export const setPwaPendingReload = (pending) => {
  const policy = readPwaReloadPolicy();
  policy.pendingReload = Boolean(pending);
  return { ...policy };
};

export const shouldReloadForServiceWorkerSwap = () => {
  const policy = readPwaReloadPolicy();
  return Boolean(policy.approved || policy.canAutoReload);
};

export const hasPendingPwaReload = () => Boolean(readPwaReloadPolicy().pendingReload);
