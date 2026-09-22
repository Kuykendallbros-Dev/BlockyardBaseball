import { describe, expect, it } from 'vitest';
import { judgeSwingWithZoneGuess, landingFrom, resolvePitch, type Landing } from './atbat.ts';
import { WINDOWS, launchVelocity } from './swing.ts';

const alwaysHit = () => 0.99; // borderline plays fall for hits
const alwaysCaught = () => 0; // borderline plays are caught

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

  it('turns a towering fly over the fence into a home run', () => {
    const landing: Landing = { distanceFt: 400, launchAngleDeg: 28, bearingDeg: 5 };
    expect(
      resolvePitch({ result: 'contact', quality: 'perfect' }, true, landing),
    ).toEqual({ kind: 'in-play', play: { hit: true, bases: 4, label: 'home run' } });
  });

  it('throws when a contact swing has no landing', () => {
    expect(() =>
      resolvePitch({ result: 'contact', quality: 'solid' }, true),
    ).toThrow(/landing/);
  });

  it('lets `rand` decide a ball hit at the edge of a fielder\'s reach', () => {
    // Toward 2B, just past his read-and-reach at "hard" — a genuine toss-up
    // between a diving stop and a ball skipping through into the outfield.
    const gapper: Landing = { distanceFt: 165, launchAngleDeg: 14, bearingDeg: 13 };
    const contact = { result: 'contact', quality: 'solid' } as const;
    const caught = resolvePitch(contact, true, gapper, alwaysCaught);
    const dropped = resolvePitch(contact, true, gapper, alwaysHit);
    expect(caught.kind === 'in-play' && caught.play.hit).toBe(false);
    expect(dropped.kind === 'in-play' && dropped.play.hit).toBe(true);
  });
});

describe('judgeSwingWithZoneGuess', () => {
  it('falls through to the normal timing model when the guess covers the crossing point', () => {
    // dead-on timing, guess dead centre, pitch crosses dead centre
    expect(judgeSwingWithZoneGuess(0, 1, { row: 2, col: 2 }, [0, 0])).toEqual({
      result: 'contact',
      quality: 'perfect',
    });
  });

  it('is an automatic whiff when the guess misses badly, even with perfect timing', () => {
    // dead-on timing would normally be a perfect hit, but the guess is the
    // opposite corner from where the pitch actually crossed
    expect(
      judgeSwingWithZoneGuess(0, 1, { row: 0, col: 0 }, [0.4, 0.5]),
    ).toEqual({ result: 'whiff', quality: null });
  });

  it('never produces a foul or contact from a bad guess, regardless of timing error', () => {
    for (const error of [0, WINDOWS.perfect, WINDOWS.solid, WINDOWS.contact, WINDOWS.foul]) {
      expect(judgeSwingWithZoneGuess(error, 1, { row: 0, col: 0 }, [0.4, 0.5])).toEqual({
        result: 'whiff',
        quality: null,
      });
    }
  });

  it('still whiffs on bad timing even when the guess is correct', () => {
    expect(
      judgeSwingWithZoneGuess(WINDOWS.foul + 0.05, 1, { row: 2, col: 2 }, [0, 0]),
    ).toEqual({ result: 'whiff', quality: null });
  });
});

describe('landingFrom', () => {
  it('reads a near-vertical pop-up as a high angle with little carry', () => {
    const { distanceFt, launchAngleDeg } = landingFrom([0, 1, 0.6], [0, 25, 0]);
    expect(launchAngleDeg).toBeGreaterThan(80);
    expect(distanceFt).toBeLessThan(3);
  });

  it('reads spray bearing from sideways velocity', () => {
    expect(landingFrom([0, 1, 0.6], [0, 8, 20]).bearingDeg).toBeCloseTo(0, 1);
    expect(landingFrom([0, 1, 0.6], [10, 8, 20]).bearingDeg).toBeGreaterThan(15);
    expect(landingFrom([0, 1, 0.6], [-10, 8, 20]).bearingDeg).toBeLessThan(-15);
  });

  it('turns a dead-on perfect swing into a deep drive', () => {
    const landing = landingFrom([0, 1, 0.6], launchVelocity(0, 'perfect'));
    expect(landing.distanceFt).toBeGreaterThan(330);
    expect(landing.launchAngleDeg).toBeGreaterThan(18);
  });
});
