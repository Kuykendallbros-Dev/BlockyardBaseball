import { describe, expect, it } from 'vitest';
import { WINDOWS, judgeSwing, launchVelocity } from './swing.ts';

describe('judgeSwing', () => {
  it('calls a dead-on swing a perfect contact', () => {
    expect(judgeSwing(0)).toEqual({ result: 'contact', quality: 'perfect' });
  });

  it('is symmetric for early and late timing', () => {
    expect(judgeSwing(-WINDOWS.solid)).toEqual(judgeSwing(WINDOWS.solid));
  });

  it('steps out through solid and weak contact as timing drifts', () => {
    expect(judgeSwing(WINDOWS.perfect + 0.001).quality).toBe('solid');
    expect(judgeSwing(WINDOWS.solid + 0.001).quality).toBe('weak');
  });

  it('is a foul just past the contact window', () => {
    expect(judgeSwing(WINDOWS.contact + 0.001)).toEqual({
      result: 'foul',
      quality: null,
    });
  });

  it('is a whiff once timing is badly off', () => {
    expect(judgeSwing(WINDOWS.foul + 0.05)).toEqual({
      result: 'whiff',
      quality: null,
    });
  });
});

describe('launchVelocity', () => {
  it('sends a dead-on perfect hit up and toward the outfield', () => {
    const [vx, vy, vz] = launchVelocity(0, 'perfect');
    expect(vx).toBeCloseTo(0);
    expect(vy).toBeGreaterThan(0);
    expect(vz).toBeGreaterThan(0); // +z is out toward the mound / outfield
  });

  it('pulls an early hit toward +x and pushes a late hit toward -x', () => {
    expect(launchVelocity(-0.1, 'solid')[0]).toBeGreaterThan(0);
    expect(launchVelocity(0.1, 'solid')[0]).toBeLessThan(0);
  });

  it('hits a perfect ball harder than a weak one', () => {
    const speed = (v: [number, number, number]) => Math.hypot(...v);
    expect(speed(launchVelocity(0, 'perfect'))).toBeGreaterThan(
      speed(launchVelocity(0, 'weak')),
    );
  });
});
