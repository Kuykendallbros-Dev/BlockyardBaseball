import { describe, expect, it } from 'vitest';
import {
  classifyBallInPlay,
  landingFrom,
  resolvePitch,
  type Landing,
} from './atbat.ts';
import { launchVelocity } from './swing.ts';

describe('resolvePitch', () => {
  it('is a called strike on a take in the zone', () => {
    expect(resolvePitch(null, true)).toEqual({ kind: 'called-strike' });
  });

  it('is a ball on a take out of the zone', () => {
    expect(resolvePitch(null, false)).toEqual({ kind: 'ball' });
  });

  it('is a swinging strike on a whiff', () => {
    expect(resolvePitch({ result: 'whiff', quality: null }, true)).toEqual({
      kind: 'swinging-strike',
    });
  });

  it('is a foul on a foul', () => {
    expect(resolvePitch({ result: 'foul', quality: null }, false)).toEqual({
      kind: 'foul',
    });
  });

  it('classifies a contact swing from its landing', () => {
    const landing: Landing = { distanceFt: 400, launchAngleDeg: 28 };
    expect(resolvePitch({ result: 'contact', quality: 'perfect' }, true, landing)).toEqual(
      { kind: 'in-play', play: { hit: true, bases: 4, label: 'home run' } },
    );
  });

  it('throws when a contact swing has no landing', () => {
    expect(() =>
      resolvePitch({ result: 'contact', quality: 'solid' }, true),
    ).toThrow(/landing/);
  });
});

describe('classifyBallInPlay', () => {
  const cases: [Landing, string][] = [
    [{ distanceFt: 380, launchAngleDeg: 30 }, 'home run'],
    [{ distanceFt: 250, launchAngleDeg: 30 }, 'flyout'], // right angle, not deep enough
    [{ distanceFt: 35, launchAngleDeg: 6 }, 'groundout'],
    [{ distanceFt: 120, launchAngleDeg: 5 }, 'single'],
    [{ distanceFt: 60, launchAngleDeg: 18 }, 'lineout'],
    [{ distanceFt: 150, launchAngleDeg: 18 }, 'single'],
    [{ distanceFt: 260, launchAngleDeg: 20 }, 'double'],
    [{ distanceFt: 310, launchAngleDeg: 22 }, 'triple'],
    [{ distanceFt: 200, launchAngleDeg: 38 }, 'flyout'],
    [{ distanceFt: 300, launchAngleDeg: 38 }, 'double'],
    [{ distanceFt: 40, launchAngleDeg: 70 }, 'popout'],
  ];

  for (const [landing, label] of cases) {
    it(`${landing.distanceFt} ft at ${landing.launchAngleDeg}° -> ${label}`, () => {
      expect(classifyBallInPlay(landing).label).toBe(label);
    });
  }

  it('marks hits as hit and outs as not', () => {
    expect(classifyBallInPlay({ distanceFt: 380, launchAngleDeg: 30 }).hit).toBe(true);
    expect(classifyBallInPlay({ distanceFt: 200, launchAngleDeg: 38 }).hit).toBe(false);
  });
});

describe('landingFrom', () => {
  it('reads a near-vertical pop-up as a high angle with little carry', () => {
    const { distanceFt, launchAngleDeg } = landingFrom([0, 1, 0.6], [0, 25, 0]);
    expect(launchAngleDeg).toBeGreaterThan(80);
    expect(distanceFt).toBeLessThan(3);
  });

  it('turns a dead-on perfect swing into a home run', () => {
    const landing = landingFrom([0, 1, 0.6], launchVelocity(0, 'perfect'));
    expect(classifyBallInPlay(landing).label).toBe('home run');
  });

  it('turns a weak early swing into an infield ground ball', () => {
    const landing = landingFrom([0, 1, 0.6], launchVelocity(-0.12, 'weak'));
    expect(landing.launchAngleDeg).toBeLessThan(10);
    expect(classifyBallInPlay(landing).hit === false || landing.distanceFt < 130).toBe(
      true,
    );
  });
});
