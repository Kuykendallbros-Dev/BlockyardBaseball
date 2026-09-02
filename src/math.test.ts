import { describe, expect, it } from 'vitest';
import { aspectRatio, orbitRadius } from './math.ts';

describe('aspectRatio', () => {
  it('divides width by height', () => {
    expect(aspectRatio(1920, 1080)).toBeCloseTo(16 / 9);
  });

  it('falls back to 1 when height is zero', () => {
    expect(aspectRatio(800, 0)).toBe(1);
  });
});

describe('orbitRadius', () => {
  it('places the camera farther back for a taller subject', () => {
    const near = orbitRadius(50, 2);
    const far = orbitRadius(50, 6);
    expect(far).toBeGreaterThan(near);
  });

  it('matches the trig identity for a 90-degree fov', () => {
    // tan(45deg) = 1, so distance == subjectHeight / 2
    expect(orbitRadius(90, 4)).toBeCloseTo(2);
  });
});
