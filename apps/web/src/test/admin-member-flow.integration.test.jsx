import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GroupRequestsCenter from '../components/GroupRequestsCenter';

const baseProps = {
  group: { id: 'g-1', name: 'Evening Club' },
  pendingRequests: [
    {
      id: 'req-1',
      groupId: 'g-1',
      userId: 'u-pending',
      name: 'Pending Player',
      email: 'pending@example.com',
      status: 'pending',
      createdAt: '2026-03-03T10:00:00.000Z',
    },
  ],
  recentReviews: [],
  members: [
    {
      id: 'm-admin',
      groupId: 'g-1',
      userId: 'u-admin',
      role: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      joinedAt: '2026-03-01T10:00:00.000Z',
    },
    {
      id: 'm-member',
      groupId: 'g-1',
      userId: 'u-member',
      role: 'member',
      name: 'Member',
      email: 'member@example.com',
      joinedAt: '2026-03-02T10:00:00.000Z',
    },
  ],
  currentUserId: 'u-admin',
  onApproveRequest: vi.fn(),
  onRejectRequest: vi.fn(),
  onPromoteMemberToAdmin: vi.fn(),
  onRemoveMember: vi.fn(),
  onConfirmAction: vi.fn(async () => true),
  onBack: vi.fn(),
  loading: false,
};

describe('Admin member/request center integration flow', () => {
  it('triggers approve/reject/promote/remove actions with confirm modal callback', async () => {
    const user = userEvent.setup();
    const props = {
      ...baseProps,
      onApproveRequest: vi.fn(),
      onRejectRequest: vi.fn(),
      onPromoteMemberToAdmin: vi.fn(),
      onRemoveMember: vi.fn(),
      onConfirmAction: vi.fn(async () => true),
    };

    render(<GroupRequestsCenter {...props} />);

    await user.click(screen.getByRole('button', { name: /^Approve$/i }));
    expect(props.onApproveRequest).toHaveBeenCalledWith('req-1');

    await user.click(screen.getByRole('button', { name: /^Reject$/i }));
    expect(props.onRejectRequest).toHaveBeenCalledWith('req-1');

    await user.click(screen.getByRole('button', { name: /^Make Admin$/i }));
    expect(props.onPromoteMemberToAdmin).toHaveBeenCalledWith('u-member');

    await user.click(screen.getByRole('button', { name: /^Remove$/i }));

    await waitFor(() => {
      expect(props.onConfirmAction).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Remove Member',
        confirmLabel: 'Remove',
        tone: 'danger',
      }));
    });
    expect(props.onRemoveMember).toHaveBeenCalledWith('u-member');
  });

  it('disables remove button for current user and prevents deleting last admin', () => {
    render(
      <GroupRequestsCenter
        {...baseProps}
        members={[
          {
            id: 'm-admin',
            groupId: 'g-1',
            userId: 'u-admin',
            role: 'admin',
            name: 'Admin',
            email: 'admin@example.com',
            joinedAt: '2026-03-01T10:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.queryByRole('button', { name: /^Remove$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Make Admin$/i })).not.toBeInTheDocument();
  });
});
