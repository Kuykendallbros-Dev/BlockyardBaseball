import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING, updateRatings } from './rating.ts';

describe('updateRatings', () => {
  it('is a zero-sum exchange between two equal ratings', () => {
    const { a, b } = updateRatings(DEFAULT_RATING, DEFAULT_RATING, true);
    expect(a).toBeGreaterThan(DEFAULT_RATING);
    expect(b).toBeLessThan(DEFAULT_RATING);
    expect(a - DEFAULT_RATING).toBe(DEFAULT_RATING - b);
  });

  it('gives the underdog more points for an upset than the favorite would gain', () => {
    const favoriteWins = updateRatings(1400, 1000, true);
    const underdogWins = updateRatings(1000, 1400, true);
    expect(underdogWins.a - 1000).toBeGreaterThan(favoriteWins.a - 1400);
  });

  it('costs the favorite more for a loss than the underdog would lose', () => {
    const favoriteLoses = updateRatings(1400, 1000, false);
    const underdogLoses = updateRatings(1000, 1400, false);
    expect(1400 - favoriteLoses.a).toBeGreaterThan(1000 - underdogLoses.a);
  });

  it('is symmetric: swapping who is a/b mirrors the result', () => {
    const asWinner = updateRatings(1200, 1000, true);
    const asLoser = updateRatings(1000, 1200, false);
    expect(asWinner.a).toBe(asLoser.b);
    expect(asWinner.b).toBe(asLoser.a);
  });
});
