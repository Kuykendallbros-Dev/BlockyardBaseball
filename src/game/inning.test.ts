import { describe, expect, it } from 'vitest';
import type { PitchOutcome } from './atbat.ts';
import { applyPitch, newHalfInning, type HalfInningState } from './inning.ts';

const ball: PitchOutcome = { kind: 'ball' };
const calledStrike: PitchOutcome = { kind: 'called-strike' };
const whiff: PitchOutcome = { kind: 'swinging-strike' };
const foul: PitchOutcome = { kind: 'foul' };
const hit = (label: 'single' | 'double' | 'triple' | 'home run'): PitchOutcome => ({
  kind: 'in-play',
  play: { hit: true, bases: label === 'home run' ? 4 : label === 'triple' ? 3 : label === 'double' ? 2 : 1, label },
});
const flyout: PitchOutcome = {
  kind: 'in-play',
  play: { hit: false, bases: 0, label: 'flyout' },
};

/** Replay a sequence of outcomes from a fresh half-inning. */
function replay(...outcomes: PitchOutcome[]): HalfInningState {
  return outcomes.reduce(applyPitch, newHalfInning());
}

describe('newHalfInning', () => {
  it('starts empty', () => {
    const s = newHalfInning();
    expect(s).toMatchObject({ balls: 0, strikes: 0, outs: 0, runs: 0, over: false });
    expect(s.bases).toEqual([false, false, false]);
  });
});

describe('count', () => {
  it('counts balls and resets on a walk', () => {
    const s = replay(ball, ball, ball, ball);
    expect(s.balls).toBe(0);
    expect(s.bases).toEqual([true, false, false]);
  });

  it('strikes out on three strikes and resets the count', () => {
    const s = replay(calledStrike, whiff, whiff);
    expect(s.outs).toBe(1);
    expect(s.strikes).toBe(0);
  });

  it('lets a foul raise the count only below two strikes', () => {
    expect(replay(foul).strikes).toBe(1);
    expect(replay(whiff, whiff, foul, foul, foul).strikes).toBe(2);
    expect(replay(whiff, whiff, foul, foul, foul).outs).toBe(0);
  });
});

describe('baserunning', () => {
  it('pushes a run in on a bases-loaded walk', () => {
    const loaded = replay(hit('single'), hit('single'), hit('single'));
    expect(loaded.bases).toEqual([true, true, true]);
    const forced = applyPitch(loaded, ball);
    const walked = [ball, ball, ball].reduce(applyPitch, forced);
    expect(walked.runs).toBe(1);
    expect(walked.bases).toEqual([true, true, true]);
  });

  it('scores a runner from third on a single', () => {
    const s = replay(hit('triple'), hit('single'));
    expect(s.runs).toBe(1);
    expect(s.bases).toEqual([true, false, false]);
  });

  it('clears the bases on a home run', () => {
    const s = replay(hit('single'), hit('single'), hit('home run'));
    expect(s.runs).toBe(3);
    expect(s.bases).toEqual([false, false, false]);
  });

  it('holds runners on an out', () => {
    const s = replay(hit('double'), flyout);
    expect(s.outs).toBe(1);
    expect(s.bases).toEqual([false, true, false]);
    expect(s.runs).toBe(0);
  });
});

describe('end of half-inning', () => {
  it('is over after the third out and ignores later pitches', () => {
    const s = replay(flyout, flyout, flyout);
    expect(s.over).toBe(true);
    expect(s.outs).toBe(3);
    const after = applyPitch(s, hit('home run'));
    expect(after).toBe(s);
  });
});
