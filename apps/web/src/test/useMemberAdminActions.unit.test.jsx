import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMemberAdminActions } from '../hooks/useMemberAdminActions';
import { STORAGE_KEYS } from '../platform/storageKeys';

describe('useMemberAdminActions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds a member to local storage in local mode', () => {
    const setMembers = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater([]);
      }
      return updater;
    });
    const updatePlayerDatabase = vi.fn();
    const showToast = vi.fn();

    const { result } = renderHook(() => useMemberAdminActions({
      members: [],
      setMembers,
      canManageMembers: true,
      updatePlayerDatabase,
      showToast,
      queryClient: { setQueryData: vi.fn() },
    }));

    let response;
    act(() => {
      response = result.current.addMember({ name: 'Alex Chen', phone: '555-0100' });
    });

    expect(response.success).toBe(true);
    expect(setMembers).toHaveBeenCalled();
    expect(updatePlayerDatabase).toHaveBeenCalledWith('Alex Chen');
    expect(localStorage.getItem(STORAGE_KEYS.MEMBERS)).toContain('Alex Chen');
  });

  it('requires name and phone when adding a member', () => {
    const { result } = renderHook(() => useMemberAdminActions({
      members: [],
      setMembers: vi.fn(),
      canManageMembers: true,
      updatePlayerDatabase: vi.fn(),
      queryClient: { setQueryData: vi.fn() },
    }));

    expect(result.current.addMember({ name: 'Alex Chen' })).toEqual({
      success: false,
      reason: 'Name and phone are required',
    });
  });

  it('deletes a member in local mode', () => {
    const members = [{ id: 'member-1', name: 'Alex Chen', phone: '555-0100' }];
    const setMembers = vi.fn((updater) => updater(members));

    const { result } = renderHook(() => useMemberAdminActions({
      members,
      setMembers,
      canManageMembers: true,
      assertCanManageMembers: () => true,
      updatePlayerDatabase: vi.fn(),
      queryClient: { setQueryData: vi.fn() },
    }));

    act(() => {
      result.current.deleteMember('member-1');
    });

    expect(setMembers).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.MEMBERS)).toBe('[]');
  });
});
