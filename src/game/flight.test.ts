import { describe, expect, it } from 'vitest';
import { GRAVITY, projectilePosition } from './flight.ts';

describe('projectilePosition', () => {
  const origin: [number, number, number] = [0, 1, 0.6];

  it('returns the origin at t = 0', () => {
    expect(projectilePosition(origin, [10, 10, -10], 0)).toEqual([...origin]);
  });

  it('treats negative time as t = 0', () => {
    expect(projectilePosition(origin, [10, 10, -10], -3)).toEqual(
      projectilePosition(origin, [10, 10, -10], 0),
    );
  });

  it('carries horizontal velocity linearly', () => {
    const [x, , z] = projectilePosition(origin, [4, 0, -20], 2);
    expect(x).toBeCloseTo(origin[0] + 8);
    expect(z).toBeCloseTo(origin[2] - 40);
  });

  it('pulls the ball down under gravity', () => {
    const y = projectilePosition(origin, [0, 0, 0], 1)[1];
    expect(y).toBeCloseTo(origin[1] - 0.5 * GRAVITY);
  });

  it('rises then falls for an upward launch', () => {
    const up = projectilePosition(origin, [0, 20, 0], 1)[1];
    const later = projectilePosition(origin, [0, 20, 0], 5)[1];
    expect(up).toBeGreaterThan(origin[1]);
    expect(later).toBeLessThan(origin[1]);
  });
});
