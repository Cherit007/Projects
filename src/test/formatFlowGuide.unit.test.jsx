// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormatFlowGuide from '../components/FormatFlowGuide';
import {
  TOURNAMENT_FORMAT_OPTIONS,
  TOURNAMENT_FORMAT_LABELS,
  buildTournamentFormatFlow,
} from '../utils/tournamentFormats';

describe('buildTournamentFormatFlow', () => {
  it('builds a league flowchart for the selected team count', () => {
    const flow3 = buildTournamentFormatFlow({ format: 'league', numTeams: 3, matchesPerPair: 1 });
    expect(flow3.exampleLabel).toContain('3 teams');
    expect(flow3.exampleLabel).toContain('3 league matches');
    expect(flow3.stages[0].matches).toEqual(expect.arrayContaining(['B vs C']));
    expect(flow3.stages[0].matches.some((match) => match.includes('bye'))).toBe(true);
    expect(flow3.stages.at(-1).matches[0]).toBe('1st place vs 2nd place');

    const flow5 = buildTournamentFormatFlow({ format: 'league', numTeams: 5, matchesPerPair: 2 });
    expect(flow5.exampleLabel).toContain('5 teams');
    expect(flow5.exampleLabel).toContain('20 league matches');
    expect(flow5.stages.some((stage) => stage.title === 'League round 1')).toBe(true);
  });

  it('builds knockout flowchart with byes for non-power-of-two counts', () => {
    const flow = buildTournamentFormatFlow({ format: 'knockoutByes', numTeams: 5 });
    expect(flow.exampleLabel).toContain('5 teams');
    expect(flow.exampleLabel).toContain('bracket size 8');
    expect(flow.stages[0].matches.some((match) => match.includes('bye'))).toBe(true);
    expect(flow.stages.at(-1).title).toBe('Final');
  });

  it('uses fixed team counts for locked formats', () => {
    const semi = buildTournamentFormatFlow({ format: 'semiFinal', numTeams: 9 });
    expect(semi.exampleLabel).toContain('4 teams');
    expect(semi.stages[0].matches).toHaveLength(2);

    const secondChance = buildTournamentFormatFlow({ format: 'doubleElim4', numTeams: 3 });
    expect(secondChance.exampleLabel).toContain('5 matches');
    expect(secondChance.stages).toHaveLength(3);

    const full = buildTournamentFormatFlow({ format: 'fullKnockout', numTeams: 3 });
    expect(full.exampleLabel).toContain('8 teams');
  });
});

describe('FormatFlowGuide', () => {
  it('opens a flowchart modal based on selected team count', async () => {
    const user = userEvent.setup();

    for (const option of TOURNAMENT_FORMAT_OPTIONS) {
      const flow = buildTournamentFormatFlow({
        format: option.value,
        numTeams: 5,
        matchesPerPair: 1,
      });
      const { unmount } = render(
        <FormatFlowGuide format={option.value} numTeams={5} matchesPerPair="1" />
      );

      await user.click(screen.getByRole('button', {
        name: `How this format works: ${TOURNAMENT_FORMAT_LABELS[option.value]}`,
      }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(flow.exampleLabel)).toBeInTheDocument();
      expect(screen.getByText(flow.stages[0].title)).toBeInTheDocument();
      expect(screen.getByText(flow.stages[flow.stages.length - 1].matches[0])).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Close format guide/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      unmount();
    }
  });
});
