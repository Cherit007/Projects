import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModalManager } from '../hooks/useModalManager';

describe('useModalManager', () => {
  it('opens confirm dialog and resolves true on confirm', async () => {
    const { result } = renderHook(() => useModalManager());
    let confirmationPromise;

    act(() => {
      confirmationPromise = result.current.requestConfirmAction({
        title: 'Delete tournament',
        message: 'Delete this tournament?',
        confirmLabel: 'Delete',
      });
    });

    expect(result.current.confirmDialog).toMatchObject({
      title: 'Delete tournament',
      message: 'Delete this tournament?',
      confirmLabel: 'Delete',
    });

    act(() => {
      result.current.resolveConfirmDialog(true);
    });

    await expect(confirmationPromise).resolves.toBe(true);
    expect(result.current.confirmDialog).toBeNull();
  });

  it('auto-cancels previous confirm request when a new one is opened', async () => {
    const { result } = renderHook(() => useModalManager());
    let firstPromise;
    let secondPromise;

    act(() => {
      firstPromise = result.current.requestConfirmAction({ message: 'First confirm' });
    });

    act(() => {
      secondPromise = result.current.requestConfirmAction({ message: 'Second confirm' });
    });

    await expect(firstPromise).resolves.toBe(false);
    expect(result.current.confirmDialog?.message).toBe('Second confirm');

    act(() => {
      result.current.resolveConfirmDialog(false);
    });

    await expect(secondPromise).resolves.toBe(false);
  });

  it('resolves in-flight confirm promise as false on unmount', async () => {
    const { result, unmount } = renderHook(() => useModalManager());
    let pendingPromise;

    act(() => {
      pendingPromise = result.current.requestConfirmAction({ message: 'Pending confirm' });
    });

    unmount();

    await expect(pendingPromise).resolves.toBe(false);
  });
});
