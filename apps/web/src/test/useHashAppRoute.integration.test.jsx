import { act, renderHook, waitFor } from '@testing-library/react';
import { useHashAppRoute } from '../hooks/useHashAppRoute';
import { APP_ROUTE_KEYS } from '../utils/appRoutes';

const baseOptions = {
  isReady: true,
  requiresAuth: false,
  currentUser: null,
  isGuestViewer: false,
  activeGroup: null,
  groupRole: null,
  showRequestCenter: false,
  setShowRequestCenter: vi.fn(),
  isViewerMode: false,
  step: 'setup',
  setStep: vi.fn(),
  hasTournamentScreenState: false,
};

describe('useHashAppRoute integration', () => {
  beforeEach(() => {
    window.location.hash = '';
    baseOptions.setStep.mockClear();
    baseOptions.setShowRequestCenter.mockClear();
  });

  it('defaults to setup route and writes #/setup when hash is empty', async () => {
    const { result } = renderHook(() => useHashAppRoute(baseOptions));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SETUP);
    });
    expect(window.location.hash).toBe('#/setup');
  });

  it('loads teams route from #/teams and calls setStep', async () => {
    window.location.hash = '#/teams';

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
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.AUTH);
    });
  });

  it('loads groups route from #/groups when authenticated without active group', async () => {
    window.location.hash = '#/groups';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
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
      activeGroup: { id: 'group-1', name: 'Club' },
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
      }),
      { initialProps: { step: 'setup' } },
    );

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SETUP);
    });

    rerender({ step: 'tournament' });

    await waitFor(() => {
      expect(window.location.hash).toBe('#/live');
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.TOURNAMENT);
    });
  });

  it('responds to hashchange events', async () => {
    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      requiresAuth: true,
      currentUser: { $id: 'user-1' },
      activeGroup: { id: 'group-1', name: 'Club' },
      groupRole: 'admin',
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SETUP);
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
    window.location.hash = '#/live';

    const { result } = renderHook(() => useHashAppRoute({
      ...baseOptions,
      step: 'setup',
      hasTournamentScreenState: false,
    }));

    await waitFor(() => {
      expect(result.current.routeKey).toBe(APP_ROUTE_KEYS.SETUP);
    });
    expect(window.location.hash).toBe('#/setup');
  });
});
