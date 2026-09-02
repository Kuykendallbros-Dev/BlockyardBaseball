import { describe, expect, it } from 'vitest';
import {
  GRAVITY,
  carryDistance,
  projectilePosition,
  timeToGround,
} from './flight.ts';

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

describe('timeToGround', () => {
  it('is the free-fall time when there is no upward velocity', () => {
    // 1 = 0.5 * g * t^2  ->  t = sqrt(2 / g)
    expect(timeToGround(1, 0)).toBeCloseTo(Math.sqrt(2 / GRAVITY));
  });

  it('lands the projectile back at y = 0', () => {
    const t = timeToGround(1.2, 15);
    expect(projectilePosition([0, 1.2, 0], [0, 15, 0], t)[1]).toBeCloseTo(0);
  });

  it('gives more hang time to a harder upward launch', () => {
    expect(timeToGround(1, 20)).toBeGreaterThan(timeToGround(1, 5));
  });
});

describe('carryDistance', () => {
  const origin: [number, number, number] = [0, 1, 0.6];

  it('is near zero for a ball hit straight up', () => {
    expect(carryDistance(origin, [0, 30, 0])).toBeLessThan(0.001);
  });

  it('rewards a harder hit with more carry', () => {
    const soft = carryDistance(origin, [0, 12, -12]);
    const hard = carryDistance(origin, [0, 20, -20]);
    expect(hard).toBeGreaterThan(soft);
  });
});
