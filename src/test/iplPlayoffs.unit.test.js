// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateKnockoutBracket, updateBracket } from '../utils/calculations';
import {
  computeBallOrbit,
  computeWheelRotation,
  flattenBracketMatches,
  generateIplPlayoffBracket,
  getCompletedBracketMatches,
  getOrdinalLabel,
  getPlayableBracketMatches,
  pickSpinIndex,
} from '../utils/iplPlayoffs';

const createTeams = (count) => (
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
    emoji: '🏸',
    player1: `P${index + 1}A`,
    player2: `P${index + 1}B`,
  }))
);

describe('ipl playoff helpers', () => {
  it('builds a 3-team eliminator + final bracket', () => {
    const bracket = generateIplPlayoffBracket(createTeams(3));
    expect(bracket).toHaveLength(2);
    expect(bracket[0][0].round).toBe('eliminator');
    expect(bracket[0][0].team1.name).toBe('Team 2');
    expect(bracket[0][0].team2.name).toBe('Team 3');
    expect(bracket[1][0].round).toBe('final');
    expect(bracket[1][0].team1.name).toBe('Team 1');
    expect(bracket[1][0].team2).toBeNull();
  });

  it('builds a 4-team IPL qualifier path and advances correctly', () => {
    const teams = createTeams(4);
    const bracket = generateIplPlayoffBracket(teams);
    expect(bracket.flat()).toHaveLength(4);
    expect(bracket[0][0].round).toBe('qualifier1');
    expect(bracket[0][1].round).toBe('eliminator');
    expect(bracket[1][0].round).toBe('qualifier2');
    expect(bracket[2][0].round).toBe('final');

    let next = updateBracket(bracket, 1, 21, 10); // Team1 beats Team2
    expect(next[2][0].team1?.name).toBe('Team 1');
    expect(next[1][0].team1?.name).toBe('Team 2');

    next = updateBracket(next, 2, 21, 15); // Team3 beats Team4
    expect(next[1][0].team2?.name).toBe('Team 3');

    next = updateBracket(next, 3, 21, 18); // Team2 beats Team3 in Q2
    expect(next[2][0].team2?.name).toBe('Team 2');

    next = updateBracket(next, 4, 21, 12);
    expect(next[2][0].completed).toBe(true);
  });

  it('exposes iplPlayoffs through generateKnockoutBracket', () => {
    const bracket = generateKnockoutBracket(createTeams(4), 'iplPlayoffs');
    expect(bracket.flat()).toHaveLength(4);
  });

  it('maps legacy doubleElim4 to ipl playoff generation', () => {
    const bracket = generateKnockoutBracket(createTeams(4), 'doubleElim4');
    expect(bracket[0][0].round).toBe('qualifier1');
  });

  it('computes wheel rotation that lands on the requested segment', () => {
    const rotation = computeWheelRotation({
      segmentCount: 4,
      landingIndex: 1,
      currentRotation: 0,
      extraSpins: 5,
    });
    const normalized = ((rotation % 360) + 360) % 360;
    // Segment 1 center is at 135deg from top clockwise → wheel rotation 360-135=225
    expect(normalized).toBeCloseTo(225, 5);
    expect(pickSpinIndex(4, () => 0.99)).toBe(3);
    expect(getOrdinalLabel(1)).toBe('1st');
    expect(getOrdinalLabel(2)).toBe('2nd');
    expect(getOrdinalLabel(3)).toBe('3rd');
    expect(getOrdinalLabel(4)).toBe('4th');
  });

  it('lists playable and completed bracket matches for live scoring', () => {
    const bracket = generateIplPlayoffBracket(createTeams(4));
    expect(getPlayableBracketMatches(bracket)).toHaveLength(2);
    expect(flattenBracketMatches(bracket)).toHaveLength(4);

    const afterQ1 = updateBracket(bracket, 1, 21, 10);
    expect(getCompletedBracketMatches(afterQ1)).toHaveLength(1);
    expect(getPlayableBracketMatches(afterQ1).map((match) => match.round)).toContain('eliminator');
  });

  it('computes ball orbit that settles back under the top marker', () => {
    const angle = computeBallOrbit({ currentAngle: 90, extraSpins: 3 });
    const normalized = ((angle % 360) + 360) % 360;
    expect(normalized).toBeCloseTo(0, 5);
    expect(angle).toBeLessThan(90);
  });
});
