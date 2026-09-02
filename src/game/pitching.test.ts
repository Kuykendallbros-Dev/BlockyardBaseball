import { describe, expect, it } from 'vitest';
import { PITCH_DURATION } from './pitch.ts';
import {
  ZONE_HALF_HEIGHT,
  ZONE_HALF_WIDTH,
  isInZone,
  plateTarget,
  rollPitch,
} from './pitching.ts';

/** A deterministic stand-in for Math.random that walks a fixed list. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('isInZone', () => {
  it('accepts the middle and the edges', () => {
    expect(isInZone([0, 0])).toBe(true);
    expect(isInZone([ZONE_HALF_WIDTH, -ZONE_HALF_HEIGHT])).toBe(true);
  });

  it('rejects a point off the plate', () => {
    expect(isInZone([ZONE_HALF_WIDTH + 0.1, 0])).toBe(false);
    expect(isInZone([0, ZONE_HALF_HEIGHT + 0.1])).toBe(false);
  });
});

describe('plateTarget', () => {
  it('offsets from the strike-zone centre and keeps the plate depth', () => {
    expect(plateTarget([0.2, -0.3])).toEqual([0.2, 0.7, 0.6]);
  });
});

describe('rollPitch', () => {
  it('picks the type by weighted roll', () => {
    expect(rollPitch(seq([0.1])).type).toBe('fastball');
    expect(rollPitch(seq([0.6])).type).toBe('breaking');
    expect(rollPitch(seq([0.85])).type).toBe('changeup');
  });

  it('scales the fastball quicker than the changeup', () => {
    const fast = rollPitch(seq([0.1, 0.5, 0.9, 0.5, 0.5]));
    const change = rollPitch(seq([0.85, 0.5, 0.9, 0.5, 0.5]));
    expect(fast.duration).toBeLessThan(PITCH_DURATION);
    expect(change.duration).toBeGreaterThan(PITCH_DURATION);
    expect(fast.duration).toBeLessThan(change.duration);
  });

  it('reports inZone from the crossing point, not the aim point', () => {
    // breaking ball aimed at the outer edge, breaks further out -> a ball
    const p = rollPitch(seq([0.6, 0.5, 0.99, 0.99, 0.5]));
    expect(p.crossing[0]).toBeCloseTo(p.location[0] + p.lateBreak[0]);
    expect(p.inZone).toBe(isInZone(p.crossing));
  });

  it('always produces a finite, sane pitch across many rolls', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 800; i++) {
      const p = rollPitch();
      counts[p.type] = (counts[p.type] ?? 0) + 1;
      expect(Number.isFinite(p.duration)).toBe(true);
      expect(p.duration).toBeGreaterThan(0.8);
      expect(p.duration).toBeLessThan(2);
      expect(p.inZone).toBe(isInZone(p.crossing));
    }
    // fastball is the most common by a clear margin
    expect(counts.fastball).toBeGreaterThan(counts.breaking ?? 0);
    expect(counts.fastball).toBeGreaterThan(counts.changeup ?? 0);
  });
});
