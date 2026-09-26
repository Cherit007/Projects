/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayoffSeedingPanel from '../components/seeding/PlayoffSeedingPanel';

const teams = [
  { id: 1, name: 'Alpha', emoji: '🔥' },
  { id: 2, name: 'Bravo', emoji: '⚡' },
  { id: 3, name: 'Charlie', emoji: '🌊' },
  { id: 4, name: 'Delta', emoji: '🌲' },
];

describe('PlayoffSeedingPanel', () => {
  it('supports manual seeding and auto-fills the last position', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PlayoffSeedingPanel teams={teams} onConfirm={onConfirm} onCancel={() => {}} />);

    await user.click(screen.getByRole('tab', { name: /Manual/i }));

    const selects = screen.getAllByRole('combobox');
    // Team rows + no spin select in manual mode → 4 selects
    expect(selects).toHaveLength(4);

    await user.selectOptions(selects[0], '1');
    await user.selectOptions(selects[1], '2');
    await user.selectOptions(selects[2], '3');

    // Last seed auto-assigned
    expect(selects[3]).toHaveValue('4');

    await user.click(screen.getByRole('button', { name: /Start Playoffs/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [ordered] = onConfirm.mock.calls[0];
    expect(ordered.map((team) => team.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('shows spin wheel by default and advances after a spin', async () => {
    const user = userEvent.setup();
    render(<PlayoffSeedingPanel teams={teams} onConfirm={() => {}} onCancel={() => {}} />);

    expect(screen.getByRole('tab', { name: /Spin wheel/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
    expect(screen.getByText(/Spinning for/i)).toBeInTheDocument();

    const disk = screen.getByRole('img', { name: /Spin wheel with 4 positions/i });
    await user.click(screen.getByRole('button', { name: /^Spin$/i }));

    await act(async () => {
      fireEvent.transitionEnd(disk, { propertyName: 'transform' });
    });

    // One team seeded; wheel remounts with remaining positions
    expect(document.querySelector('.playoff-seed-chip.is-seeded')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Spin wheel with 3 positions/i })).toBeInTheDocument();
  });
});