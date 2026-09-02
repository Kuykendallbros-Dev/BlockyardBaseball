import { describe, expect, it } from 'vitest';
import { PLATE_POINT, RELEASE_POINT, ballPositionAt } from './pitch.ts';

describe('ballPositionAt', () => {
  it('starts at the release point', () => {
    expect(ballPositionAt(0)).toEqual([...RELEASE_POINT]);
  });

  it('ends at the plate point', () => {
    const end = ballPositionAt(1);
    expect(end[0]).toBeCloseTo(PLATE_POINT[0]);
    expect(end[1]).toBeCloseTo(PLATE_POINT[1]);
    expect(end[2]).toBeCloseTo(PLATE_POINT[2]);
  });

  it('clamps fractions outside [0, 1]', () => {
    expect(ballPositionAt(-2)).toEqual(ballPositionAt(0));
    expect(ballPositionAt(5)).toEqual(ballPositionAt(1));
  });

  it('arcs above the straight-line path at mid-flight', () => {
    const midY = ballPositionAt(0.5)[1];
    const lineY = (RELEASE_POINT[1] + PLATE_POINT[1]) / 2;
    expect(midY).toBeGreaterThan(lineY);
  });

  it('moves monotonically toward the plate in z', () => {
    let prev = Infinity;
    for (let u = 0; u <= 1; u += 0.1) {
      const z = ballPositionAt(u)[2];
      expect(z).toBeLessThan(prev);
      prev = z;
    }
  });

  it('ends at a custom target', () => {
    const target: [number, number, number] = [0.3, 1.4, 0.6];
    const end = ballPositionAt(1, target);
    expect(end[0]).toBeCloseTo(target[0]);
    expect(end[1]).toBeCloseTo(target[1]);
    expect(end[2]).toBeCloseTo(target[2]);
  });

  it('applies late break that is negligible early and full at the plate', () => {
    const lateBreak: [number, number] = [0.4, -0.3];
    const early = ballPositionAt(0.1, PLATE_POINT, lateBreak);
    const straightEarly = ballPositionAt(0.1);
    const end = ballPositionAt(1, PLATE_POINT, lateBreak);

    expect(Math.abs(early[0] - straightEarly[0])).toBeLessThan(0.01);
    expect(end[0]).toBeCloseTo(PLATE_POINT[0] + lateBreak[0]);
    expect(end[1]).toBeCloseTo(PLATE_POINT[1] + lateBreak[1]);
  });
});
