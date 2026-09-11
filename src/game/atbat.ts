/**
 * Pure at-bat outcome model — the spine of a full game. Takes a resolved swing
 * (or a take) plus, on contact, where the ball landed, and returns a single
 * pitch-level outcome: ball, called strike, swinging strike, foul, or a ball in
 * play resolved by `./fielding.ts` into an out or a hit. Count- and inning-level
 * bookkeeping (strikeouts, walks, outs, runs) lives in `./inning.ts`.
 */

import { METRES_TO_FEET, carryDistance } from './flight.ts';
import { type BallInPlay, type FieldingDifficulty, fieldBallInPlay } from './fielding.ts';
import type { SwingJudgement } from './swing.ts';

export type { BallInPlay, FieldingDifficulty, HitLabel, OutLabel } from './fielding.ts';
export { FENCE_FT } from './fielding.ts';

export type PitchOutcome =
  | { kind: 'ball' }
  | { kind: 'called-strike' }
  | { kind: 'swinging-strike' }
  | { kind: 'foul' }
  | { kind: 'in-play'; play: BallInPlay };

/** Where and how a batted ball came off the bat. */
export interface Landing {
  /** Carry distance in feet. */
  distanceFt: number;
  /** Launch angle off the bat, in degrees (0 = flat, 90 = straight up). */
  launchAngleDeg: number;
  /** Spray bearing in degrees: 0 = dead centre, - = left field, + = right. */
  bearingDeg: number;
}

/** Derive a {@link Landing} from a batted-ball velocity and contact point. */
export function landingFrom(
  contactPoint: readonly [number, number, number],
  velocity: readonly [number, number, number],
): Landing {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  const launchAngleDeg =
    speed === 0 ? 0 : (Math.asin(velocity[1] / speed) * 180) / Math.PI;
  const bearingDeg = (Math.atan2(velocity[0], velocity[2]) * 180) / Math.PI;
  const distanceFt = carryDistance(contactPoint, velocity) * METRES_TO_FEET;
  return { distanceFt, launchAngleDeg, bearingDeg };
}

/**
 * Resolve one pitch. `swing` is `null` when the batter did not offer. `landing`
 * is required when `swing` is a contact swing. `rand` (in [0, 1)) settles the
 * borderline fielding plays; it defaults to a deterministic midpoint.
 * `difficulty` is the defense's fielding proficiency — a placeholder dial
 * until Phase 2 derives it from player attributes/skills instead.
 */
export function resolvePitch(
  swing: SwingJudgement | null,
  pitchInZone: boolean,
  landing: Landing | null = null,
  rand: () => number = () => 0.5,
  difficulty: FieldingDifficulty = 'hard',
): PitchOutcome {
  if (swing === null) {
    return pitchInZone ? { kind: 'called-strike' } : { kind: 'ball' };
  }

  if (swing.result === 'whiff') return { kind: 'swinging-strike' };
  if (swing.result === 'foul') return { kind: 'foul' };

  if (landing === null) {
    throw new Error('resolvePitch: a contact swing needs a landing');
  }
  return { kind: 'in-play', play: fieldBallInPlay(landing, rand, difficulty) };
}
