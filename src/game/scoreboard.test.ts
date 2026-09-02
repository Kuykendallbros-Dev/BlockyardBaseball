import { describe, expect, it } from 'vitest';
import { newHalfInning } from './inning.ts';
import {
  basesLabel,
  battingSide,
  formatScoreboard,
  halfInningLabel,
  inningNumber,
  outsLabel,
} from './scoreboard.ts';

describe('half-inning identity', () => {
  it('counts innings and sides from the half index', () => {
    expect(halfInningLabel(0)).toBe('TOP 1');
    expect(halfInningLabel(1)).toBe('BOT 1');
    expect(halfInningLabel(4)).toBe('TOP 3');
    expect(inningNumber(5)).toBe(3);
    expect(battingSide(0)).toBe('away');
    expect(battingSide(3)).toBe('home');
  });
});

describe('outsLabel', () => {
  it('singularises one out', () => {
    expect(outsLabel(0)).toBe('0 outs');
    expect(outsLabel(1)).toBe('1 out');
    expect(outsLabel(2)).toBe('2 outs');
  });
});

describe('basesLabel', () => {
  it('names every occupancy', () => {
    expect(basesLabel([false, false, false])).toBe('bases empty');
    expect(basesLabel([true, false, false])).toBe('runner on 1st');
    expect(basesLabel([false, true, false])).toBe('runner on 2nd');
    expect(basesLabel([false, false, true])).toBe('runner on 3rd');
    expect(basesLabel([true, true, false])).toBe('1st & 2nd');
    expect(basesLabel([true, false, true])).toBe('corners');
    expect(basesLabel([false, true, true])).toBe('2nd & 3rd');
    expect(basesLabel([true, true, true])).toBe('bases loaded');
  });
});

describe('formatScoreboard', () => {
  it('lays out the whole line', () => {
    const state = { ...newHalfInning(), balls: 2, strikes: 1, outs: 1 };
    expect(formatScoreboard(2, state, { away: 3, home: 2 })).toBe(
      'TOP 2  ·  2-1  ·  1 out  ·  bases empty  ·  AWAY 3  HOME 2',
    );
  });
});
