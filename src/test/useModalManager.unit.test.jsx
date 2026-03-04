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

  it('reuses in-flight confirm request when duplicate confirm calls happen', async () => {
    const { result } = renderHook(() => useModalManager());
    let firstPromise;
    let secondPromise;

    act(() => {
      firstPromise = result.current.requestConfirmAction({ message: 'First confirm' });
    });

    act(() => {
      secondPromise = result.current.requestConfirmAction({ message: 'Second confirm' });
    });

    expect(firstPromise).toBe(secondPromise);
    expect(result.current.confirmDialog?.message).toBe('First confirm');

    act(() => {
      result.current.resolveConfirmDialog(true);
    });

    await expect(firstPromise).resolves.toBe(true);
    await expect(secondPromise).resolves.toBe(true);
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
