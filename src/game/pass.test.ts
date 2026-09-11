import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import {
  PASS_MAX_LEVEL,
  POINTS_PER_LEVEL,
  applyPassGain,
  newPass,
  pointsFor,
  progressFor,
} from './pass.ts';

function finishedGame(overrides: Partial<GameState>): GameState {
  return {
    halfIndex: 17,
    half: {
      balls: 0,
      strikes: 0,
      outs: 3,
      bases: [false, false, false],
      runs: 0,
      over: true,
      lastEvent: 'side retired',
    },
    score: { away: 2, home: 5 },
    lineScore: [],
    final: true,
    winner: 'home',
    ...overrides,
  };
}

describe('pointsFor', () => {
  it('pays nothing for an unfinished game', () => {
    expect(pointsFor(finishedGame({ final: false }), 'home')).toBe(0);
  });

  it('pays more for a win than a loss with the same runs', () => {
    const lost = finishedGame({ score: { away: 5, home: 3 }, winner: 'away' });
    const won = finishedGame({ score: { away: 3, home: 5 }, winner: 'home' });
    expect(pointsFor(won, 'home')).toBeGreaterThan(pointsFor(lost, 'home'));
  });
});

describe('progressFor', () => {
  it('starts at level 1 with nothing earned', () => {
    expect(progressFor(0)).toEqual({
      level: 1,
      intoLevel: 0,
      needed: POINTS_PER_LEVEL,
      maxed: false,
    });
  });

  it('reports maxed once past the top level', () => {
    const progress = progressFor(PASS_MAX_LEVEL * POINTS_PER_LEVEL);
    expect(progress.level).toBe(PASS_MAX_LEVEL);
    expect(progress.maxed).toBe(true);
  });
});

describe('applyPassGain', () => {
  it('accumulates points without leveling up until a full level is earned', () => {
    const gain = applyPassGain(newPass(), POINTS_PER_LEVEL - 1);
    expect(gain.levelsGained).toBe(0);
    expect(gain.coinsAwarded).toBe(0);
    expect(gain.state.points).toBe(POINTS_PER_LEVEL - 1);
  });

  it('reports a level gained and a coin reward when a level completes', () => {
    const gain = applyPassGain(newPass(), POINTS_PER_LEVEL);
    expect(gain.levelsGained).toBe(1);
    expect(gain.coinsAwarded).toBeGreaterThan(0);
  });

  it('caps at the max level instead of accumulating past it', () => {
    const maxed = { points: PASS_MAX_LEVEL * POINTS_PER_LEVEL };
    const gain = applyPassGain(maxed, 500);
    expect(gain.levelsGained).toBe(0);
    expect(gain.state.points).toBe(maxed.points);
  });
});
