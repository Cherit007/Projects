import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMemberLinkEffect } from '../hooks/useMemberLinkEffect';

const buildProps = (overrides = {}) => ({
  requiresAuth: true,
  currentUser: {
    $id: 'u-1',
    email: 'john@example.com',
    name: 'John',
  },
  activeGroup: { id: 'g-1', name: 'Club' },
  groupRole: 'member',
  isGuestViewer: false,
  loading: false,
  members: [],
  playerDatabase: [],
  teams: [],
  pendingLinkPrompt: null,
  setPendingLinkPrompt: vi.fn(),
  setMembers: vi.fn(),
  saveMembersToLocal: vi.fn(),
  linkPromptedRef: { current: new Set() },
  ...overrides,
});

describe('useMemberLinkEffect', () => {
  it('prompts linking when same-name member exists and is not linked', async () => {
    const props = buildProps({
      members: [
        { id: 'm-1', name: 'John', phone: '' },
      ],
    });

    renderHook(() => useMemberLinkEffect(props));

    await waitFor(() => {
      expect(props.setPendingLinkPrompt).toHaveBeenCalledWith(expect.objectContaining({
        type: 'member',
        memberId: 'm-1',
        memberName: 'John',
        displayName: 'John',
      }));
    });
  });

  it('auto-links identity when member is already matched by email/account', async () => {
    const props = buildProps({
      members: [
        {
          id: 'm-1',
          name: '',
          phone: '',
          linkedEmail: 'john@example.com',
          linkedAccountId: '',
        },
      ],
      pendingLinkPrompt: { type: 'member', memberId: 'm-1' },
    });

    renderHook(() => useMemberLinkEffect(props));

    await waitFor(() => {
      expect(props.setPendingLinkPrompt).toHaveBeenCalledWith(null);
    });

    expect(props.setMembers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'm-1',
        linkedEmail: 'john@example.com',
        linkedAccountId: 'u-1',
        name: 'John',
      }),
    ]);
    expect(props.saveMembersToLocal).toHaveBeenCalled();
  });

  it('clears pending prompt when role changes away from member', async () => {
    const props = buildProps({
      groupRole: 'viewer',
      pendingLinkPrompt: { type: 'member', memberId: 'm-1' },
    });

    renderHook(() => useMemberLinkEffect(props));

    await waitFor(() => {
      expect(props.setPendingLinkPrompt).toHaveBeenCalledWith(null);
    });
  });
});
