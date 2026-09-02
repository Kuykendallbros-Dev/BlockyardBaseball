/**
 * Integration check for the pure at-bat/inning chain the scene drives. Not the
 * full Phase 1 end-to-end (that is P1-8, once the AI and game loop exist) — this
 * just proves a half-inning always terminates with a coherent line.
 */

import { describe, expect, it } from 'vitest';
import { classifyBallInPlay, landingFrom, resolvePitch } from './atbat.ts';
import type { PitchOutcome } from './atbat.ts';
import { launchVelocity } from './swing.ts';
import { rollPitch } from './pitching.ts';
import { judgeSwing } from './swing.ts';
import { applyPitch, newHalfInning } from './inning.ts';

/** Mulberry32 — a tiny deterministic PRNG so the sim is reproducible. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTACT_POINT = [0, 1, 0.6] as const;

/** One pitch: the batter swings with random timing error, or takes it. */
function simulatePitch(rand: () => number): PitchOutcome {
  const pitch = rollPitch(rand);
  const swings = rand() < 0.72;
  if (!swings) return resolvePitch(null, pitch.inZone);

  const error = (rand() - 0.5) * 0.5; // +/- 0.25 s
  const judgement = judgeSwing(error);
  if (judgement.result !== 'contact' || !judgement.quality) {
    return resolvePitch(judgement, pitch.inZone);
  }
  const velocity = launchVelocity(error, judgement.quality);
  return {
    kind: 'in-play',
    play: classifyBallInPlay(landingFrom(CONTACT_POINT, velocity)),
  };
}

describe('half-inning simulation', () => {
  it('always ends at exactly three outs within a sane pitch count', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      let state = newHalfInning();
      let pitches = 0;

      while (!state.over) {
        state = applyPitch(state, simulatePitch(rand));
        pitches += 1;
        expect(pitches).toBeLessThan(500);
      }

      expect(state.outs).toBe(3);
      expect(state.runs).toBeGreaterThanOrEqual(0);
      expect(state.balls).toBe(0);
      expect(state.strikes).toBe(0);
      state.bases.forEach((occupied) => expect(typeof occupied).toBe('boolean'));
    }
  });

  it('produces at least one scoring half-inning over many seeds', () => {
    let scored = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      let state = newHalfInning();
      while (!state.over) state = applyPitch(state, simulatePitch(rand));
      if (state.runs > 0) scored += 1;
    }
    expect(scored).toBeGreaterThan(0);
  });
});
