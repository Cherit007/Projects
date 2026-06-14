import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileBottomNav from '../components/MobileBottomNav';

describe('MobileBottomNav', () => {
  it('reuses the tournament command bar pattern and keeps handlers wired', async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    const onLive = vi.fn();
    const onStats = vi.fn();
    const onProfile = vi.fn();
    const onPrimaryAction = vi.fn();

    render(
      <MobileBottomNav
        isVisible
        activeKey="stats"
        onHome={onHome}
        onLive={onLive}
        onStats={onStats}
        onProfile={onProfile}
        onPrimaryAction={onPrimaryAction}
      />
    );

    const shell = document.querySelector('.app-mobile-bottom-command-bar');
    expect(shell).toBeTruthy();
    expect(shell.querySelector('.tour-command-bar')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stats/i }).className).toContain('tour-command-btn-active');

    await user.click(screen.getByRole('button', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: /Live/i }));
    await user.click(screen.getByRole('button', { name: /Create/i }));
    await user.click(screen.getByRole('button', { name: /Profile/i }));

    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onLive).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onStats).toHaveBeenCalledTimes(0);
  });
});
