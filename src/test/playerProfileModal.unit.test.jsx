import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerProfileModal from '../components/PlayerProfileModal';

describe('PlayerProfileModal', () => {
  it('renders player details and recent history, then closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <PlayerProfileModal
        playerName="Alex"
        profile={{
          rating: 1042,
          matchesPlayed: 2,
          history: [
            {
              matchId: 'm1',
              opponent: 'Bob',
              result: 'win',
              change: 14,
              date: '2026-02-24T10:00:00.000Z'
            },
            {
              matchId: 'm2',
              opponent: 'Cara',
              result: 'loss',
              change: -9,
              date: '2026-02-24T11:00:00.000Z'
            }
          ]
        }}
        team={{ name: 'Shuttlers', emoji: '🏸' }}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Shuttlers', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('1042').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent Match History')).toBeInTheDocument();
    expect(screen.getByText(/vs Bob/i)).toBeInTheDocument();
    expect(screen.getByText(/vs Cara/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close profile/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when no player is selected', () => {
    const { container } = render(
      <PlayerProfileModal playerName={null} profile={null} team={null} onClose={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });
});
