/**
 * Pure at-bat outcome model — the spine of a full game. Takes a resolved swing
 * (or a take) plus, on contact, where the ball landed, and returns a single
 * pitch-level outcome: ball, called strike, swinging strike, foul, or a ball in
 * play resolved by `./fielding.ts` into an out or a hit. Count- and inning-level
 * bookkeeping (strikeouts, walks, outs, runs) lives in `./inning.ts`.
 */

import { METRES_TO_FEET, carryDistance } from './flight.ts';
import { type BallInPlay, type FieldingDifficulty, fieldBallInPlay } from './fielding.ts';
import { judgeSwing, type SwingJudgement } from './swing.ts';
import { isZoneGuessCorrect, type TileCoord } from './strikezone.ts';

export type { BallInPlay, FieldingDifficulty, HitLabel, OutLabel } from './fielding.ts';
export { FENCE_FT } from './fielding.ts';

/** Spray angle, in degrees either side of centre, where fair territory ends. */
export const FOUL_LINE_DEG = 45;

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
 * Gate the existing timing-based swing judgement behind the batter's strike-
 * zone guess (see `./strikezone.ts`). If `chosenTile` isn't within tolerance of
 * where the pitch actually crossed, the swing is an automatic whiff and
 * `judgeSwing` never runs — no second probability roll on top of the timing
 * model, the zone guess is purely a gate on whether contact resolution
 * happens at all. This is a human-batter-only concern: the AI (`./ai.ts`,
 * `./sim.ts`) doesn't guess zones and keeps calling `judgeSwing` directly.
 */
export function judgeSwingWithZoneGuess(
  errorSeconds: number,
  contactMultiplier: number,
  chosenTile: TileCoord,
  crossing: readonly [number, number],
): SwingJudgement {
  if (!isZoneGuessCorrect(chosenTile, crossing)) {
    return { result: 'whiff', quality: null };
  }
  return judgeSwing(errorSeconds, contactMultiplier);
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
  // Outside the foul lines it is a foul ball, not a ball the defence plays.
  if (Math.abs(landing.bearingDeg) > FOUL_LINE_DEG) return { kind: 'foul' };
  return { kind: 'in-play', play: fieldBallInPlay(landing, rand, difficulty) };
}
