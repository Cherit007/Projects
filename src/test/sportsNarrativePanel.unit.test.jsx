import { render, screen } from '@testing-library/react';
import SportsNarrativePanel from '../components/home/SportsNarrativePanel';

describe('SportsNarrativePanel', () => {
  it('renders duplicate upset matchups without React key warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SportsNarrativePanel
        narratives={{
          upsetWatch: [
            {
              matchup: 'Falcons vs Sharks',
              underdog: 'Falcons',
              underdogProbability: 0.34,
            },
            {
              matchup: 'Falcons vs Sharks',
              underdog: 'Falcons',
              underdogProbability: 0.34,
            },
          ],
        }}
      />
    );

    expect(screen.getAllByText('Falcons vs Sharks')).toHaveLength(2);
    expect(
      errorSpy.mock.calls.some((call) => call.join(' ').includes('Encountered two children with the same key'))
    ).toBe(false);

    errorSpy.mockRestore();
  });
});
