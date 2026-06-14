import { act, renderHook, waitFor } from '@testing-library/react';
import { useHashAppRoute } from '../hooks/useHashAppRoute';
import { APP_ROUTE_KEYS } from '../utils/appRoutes';

const baseOptions = {
  isReady: true,
  requiresAuth: false,
  currentUser: null,
  isGuestViewer: false,
  activeGroup: { id: 'group-1', name: 'Club' },
  activeGroupId: 'group-1',
  groupRole: 'admin',
  showRequestCenter: false,
  setShowRequestCenter: vi.fn(),
  isViewerMode: false,
  step: 'setup',
  setStep: vi.fn(),
  sportId: 'badminton',
  setSportId: vi.fn(),
  applySportContext: vi.fn(),
  hasTournamentScreenState: false,
};

describe('useHashAppRoute integration', () => {
  beforeEach(() => {
    window.location.hash = '';
    baseOptions.setStep.mockClear();
    baseOptions.setShowRequestCenter.mockClear();
    baseOptions.applySportContext.mockClear();
  });

  it('defaults to sport hub route and writes #/sports when hash is empty', async () => {
    const { result } = renderHook(() => useHashAppRoute(baseOptions));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SPORT_HUB);
    });
    expect(window.location.hash).toBe('#/sports');
  });

  it('loads sport home route from #/sports/boxCricket', async () => {
    window.location.hash = '#/sports/boxCricket';

    const { result } = renderHook(() => useHashAppRoute(baseOptions));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SETUP);
    });
    expect(baseOptions.applySportContext).toHaveBeenCalledWith('boxCricket');
  });

  it('loads teams route from sport-scoped hash and calls setStep', async () => {
    window.location.hash = '#/sports/badminton/teams';

    renderHook(() => useHashAppRoute({
      ...baseOptions,
      step: 'setup',
    }));

    await waitFor(() => {
      expect(baseOptions.setStep).toHaveBeenCalledWith('teams');
    });
  });

  it('loads auth route from #/auth when auth is required and user is absent', async () => {
    window.location.hash = '#/auth';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
      currentUser: null,
      isGuestViewer: false,
      activeGroup: null,
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.AUTH);
    });
  });

    it('loads groups route from #/groups when authenticated without active group and groups are enabled', async () => {
    window.location.hash = '#/groups';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
      groupsEnabled: true,
      currentUser: { $id: 'user-1' },
      activeGroup: null,
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.GROUPS);
    });
  });

  it('loads viewer route from #/viewer in viewer mode', async () => {
    window.location.hash = '#/viewer';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
      currentUser: { $id: 'user-1' },
      groupRole: 'viewer',
      isViewerMode: true,
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.VIEWER);
    });
  });

  it('syncs hash when step changes to tournament', async () => {
    const { result, rerender } = renderHook(
      ({ step }) => useHashAppRoute({
        ...baseOptions,
        step,
        hasTournamentScreenState: step === 'tournament',
        sportId: 'badminton',
      }),
      { initialProps: { step: 'setup' } },
    );

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SPORT_HUB);
    });

    rerender({ step: 'tournament' });

    await waitFor(() => {
      expect(window.location.hash).toBe('#/sports/badminton/live');
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.TOURNAMENT);
    });
  });

  it('responds to hashchange events', async () => {
    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
      currentUser: { $id: 'user-1' },
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SPORT_HUB);
    });

    act(() => {
      window.location.hash = '#/groups/requests';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.GROUP_REQUESTS);
    });
    expect(baseOptions.setShowRequestCenter).toHaveBeenCalledWith(true);
  });

  it('falls back when #/live is requested without tournament state', async () => {
    window.location.hash = '#/sports/badminton/live';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      step: 'setup',
      hasTournamentScreenState: false,
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SPORT_HUB);
    });
    expect(window.location.hash).toBe('#/sports');
  });
});
