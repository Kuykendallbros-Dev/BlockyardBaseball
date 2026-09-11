import { describe, expect, it } from 'vitest';
import {
  BASELINE_ATTRIBUTES,
  MAX_LEVEL,
  MIN_LEVEL,
  attributesForLevel,
  contactMultiplier,
  powerMultiplier,
  speedMultiplier,
} from './attributes.ts';

describe('attributesForLevel', () => {
  it('lands the midpoint level on the baseline attributes', () => {
    const mid = (MIN_LEVEL + MAX_LEVEL) / 2;
    expect(attributesForLevel(mid)).toEqual(BASELINE_ATTRIBUTES);
  });

  it('gives the lowest level the lowest attributes and the highest the highest', () => {
    const low = attributesForLevel(MIN_LEVEL);
    const high = attributesForLevel(MAX_LEVEL);
    expect(low.power).toBeLessThan(BASELINE_ATTRIBUTES.power);
    expect(high.power).toBeGreaterThan(BASELINE_ATTRIBUTES.power);
    expect(low.power).toBeLessThan(high.power);
  });

  it('clamps levels outside the range instead of extrapolating', () => {
    expect(attributesForLevel(MIN_LEVEL - 5)).toEqual(attributesForLevel(MIN_LEVEL));
    expect(attributesForLevel(MAX_LEVEL + 5)).toEqual(attributesForLevel(MAX_LEVEL));
  });
});

describe('attribute multipliers', () => {
  it('the baseline attribute maps to a multiplier of exactly 1', () => {
    expect(powerMultiplier(BASELINE_ATTRIBUTES.power)).toBe(1);
    expect(contactMultiplier(BASELINE_ATTRIBUTES.contact)).toBe(1);
    expect(speedMultiplier(BASELINE_ATTRIBUTES.speed)).toBe(1);
  });

  it('a higher stat gives a higher multiplier and a lower stat a lower one', () => {
    expect(powerMultiplier(1)).toBeGreaterThan(powerMultiplier(0.5));
    expect(powerMultiplier(0)).toBeLessThan(powerMultiplier(0.5));
  });

  it('clamps out-of-range stats instead of extrapolating', () => {
    expect(powerMultiplier(-1)).toBe(powerMultiplier(0));
    expect(powerMultiplier(2)).toBe(powerMultiplier(1));
  });
});
