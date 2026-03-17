import { useRef, useSyncExternalStore } from 'react';
import { dedupeTournamentHistory, sortTournamentHistoryByRecent } from '../utils/appHelpers';

const createAppStore = () => {
  const initialState = {
    // Tournament slice
    step: 'setup',
    tournamentName: '',
    numTeams: 3,
    format: '1',
    gameMode: 'doubles',
    tournamentFormat: 'league',
    teams: [],
    fixtures: [],
    bracket: [],
    champion: null,
    loading: false,
    playerDatabase: [],
    members: [],
    playerRatings: {},
    tournamentHistory: [],
    casualMatches: [],
    tournamentTemplates: [],
    playerPhotos: {},
    playerPhotoRefs: {},
    pendingPrefilledTeams: null,
    aiMatchSummaries: [],
    swapHistory: [],

    // Auth + group slice
    authLoading: false,
    authResolved: false,
    currentUser: null,
    groupResolved: false,
    availableGroups: [],
    publicGroups: [],
    requestedGroupIds: [],
    pendingJoinRequests: [],
    recentJoinReviews: [],
    seenPendingRequestIds: [],
    showRequestCenter: false,
    activeGroup: null,
    groupRole: null,
    inviteLoading: false,
    isGuestViewer: false,
    adminAccounts: [],
  };

  const listeners = new Set();
  let state;

  const getState = () => state;

  const setState = (partialOrUpdater) => {
    const nextPartial = typeof partialOrUpdater === 'function'
      ? partialOrUpdater(state)
      : partialOrUpdater;

    if (!nextPartial || typeof nextPartial !== 'object') return;
    state = { ...state, ...nextPartial };
    listeners.forEach((listener) => listener());
  };

  const setField = (key, valueOrUpdater) => {
    setState((prev) => ({
      [key]: typeof valueOrUpdater === 'function'
        ? valueOrUpdater(prev[key])
        : valueOrUpdater,
    }));
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const actions = {
    setStep: (value) => setField('step', value),
    setTournamentName: (value) => setField('tournamentName', value),
    setNumTeams: (value) => setField('numTeams', value),
    setFormat: (value) => setField('format', value),
    setGameMode: (value) => setField('gameMode', value),
    setTournamentFormat: (value) => setField('tournamentFormat', value),
    setTeams: (value) => setField('teams', value),
    setFixtures: (value) => setField('fixtures', value),
    setBracket: (value) => setField('bracket', value),
    setChampion: (value) => setField('champion', value),
    setLoading: (value) => setField('loading', value),
    setPlayerDatabase: (value) => setField('playerDatabase', value),
    setMembers: (value) => setField('members', value),
    setPlayerRatings: (value) => setField('playerRatings', value),
    setTournamentHistory: (value) => setState((prev) => {
      const nextValue = typeof value === 'function'
        ? value(prev.tournamentHistory)
        : value;
      const deduped = dedupeTournamentHistory(nextValue);
      return {
        tournamentHistory: sortTournamentHistoryByRecent(deduped),
      };
    }),
    setCasualMatches: (value) => setField('casualMatches', value),
    setTournamentTemplates: (value) => setField('tournamentTemplates', value),
    setPlayerPhotos: (value) => setField('playerPhotos', value),
    setPlayerPhotoRefs: (value) => setField('playerPhotoRefs', value),
    setPendingPrefilledTeams: (value) => setField('pendingPrefilledTeams', value),
    setAiMatchSummaries: (value) => setField('aiMatchSummaries', value),
    setSwapHistory: (value) => setField('swapHistory', value),
    setAuthLoading: (value) => setField('authLoading', value),
    setAuthResolved: (value) => setField('authResolved', value),
    setCurrentUser: (value) => setField('currentUser', value),
    setGroupResolved: (value) => setField('groupResolved', value),
    setAvailableGroups: (value) => setField('availableGroups', value),
    setPublicGroups: (value) => setField('publicGroups', value),
    setRequestedGroupIds: (value) => setField('requestedGroupIds', value),
    setPendingJoinRequests: (value) => setField('pendingJoinRequests', value),
    setRecentJoinReviews: (value) => setField('recentJoinReviews', value),
    setSeenPendingRequestIds: (value) => setField('seenPendingRequestIds', value),
    setShowRequestCenter: (value) => setField('showRequestCenter', value),
    setActiveGroup: (value) => setField('activeGroup', value),
    setGroupRole: (value) => setField('groupRole', value),
    setInviteLoading: (value) => setField('inviteLoading', value),
    setIsGuestViewer: (value) => setField('isGuestViewer', value),
    setAdminAccounts: (value) => setField('adminAccounts', value),
  };

  const buildSnapshot = () => ({
    ...initialState,
    ...actions,
  });

  state = buildSnapshot();

  return {
    getState,
    setState,
    subscribe,
    resetState: () => {
      state = buildSnapshot();
      listeners.forEach((listener) => listener());
    },
    ...actions,
  };
};

export const appStore = createAppStore();

export const useAppStore = (selector) => useSyncExternalStore(
  appStore.subscribe,
  () => selector(appStore.getState()),
  () => selector(appStore.getState()),
);

export const shallowEqual = (left, right) => {
  if (Object.is(left, right)) return true;
  if (!left || !right) return false;
  if (typeof left !== 'object' || typeof right !== 'object') return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
};

export const useAppStoreShallow = (selector) => {
  const lastSelectionRef = useRef();
  return useSyncExternalStore(
    appStore.subscribe,
    () => {
      const nextSelection = selector(appStore.getState());
      const previousSelection = lastSelectionRef.current;
      if (shallowEqual(previousSelection, nextSelection)) {
        return previousSelection;
      }
      lastSelectionRef.current = nextSelection;
      return nextSelection;
    },
    () => {
      const nextSelection = selector(appStore.getState());
      const previousSelection = lastSelectionRef.current;
      if (shallowEqual(previousSelection, nextSelection)) {
        return previousSelection;
      }
      lastSelectionRef.current = nextSelection;
      return nextSelection;
    },
  );
};
