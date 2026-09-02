/**
 * Pure at-bat outcome model — the spine of a full game. Takes a resolved swing
 * (or a take) plus, on contact, where the ball landed, and returns a single
 * pitch-level outcome: ball, called strike, swinging strike, foul, or a ball in
 * play classified as an out or a hit. Count- and inning-level bookkeeping
 * (strikeouts, walks, outs, runs) lives in `./inning.ts`, not here.
 *
 * Arcade-leaning by design: classification is deterministic from carry distance
 * and launch angle, with no fielder positioning or randomness. See the roadmap
 * "arcade vs sim depth" note.
 */

import { METRES_TO_FEET, carryDistance } from './flight.ts';
import type { SwingJudgement } from './swing.ts';

/** Outfield fence distance, in feet. Anything hit past it in the air is gone. */
export const FENCE_FT = 330;

export type HitLabel = 'single' | 'double' | 'triple' | 'home run';
export type OutLabel = 'groundout' | 'lineout' | 'flyout' | 'popout';

export interface BallInPlay {
  /** true = the batter reached base, false = the batter is out. */
  hit: boolean;
  /** Bases taken by the batter: 0 on an out, 1–4 on a hit. */
  bases: 0 | 1 | 2 | 3 | 4;
  label: HitLabel | OutLabel;
}

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
}

/** Derive a {@link Landing} from a batted-ball velocity and contact point. */
export function landingFrom(
  contactPoint: readonly [number, number, number],
  velocity: readonly [number, number, number],
): Landing {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  const launchAngleDeg =
    speed === 0 ? 0 : (Math.asin(velocity[1] / speed) * 180) / Math.PI;
  const distanceFt = carryDistance(contactPoint, velocity) * METRES_TO_FEET;
  return { distanceFt, launchAngleDeg };
}

/**
 * Classify a ball in play as an out or a hit purely from its carry distance and
 * launch angle.
 */
export function classifyBallInPlay(landing: Landing): BallInPlay {
  const { distanceFt: d, launchAngleDeg: angle } = landing;

  if (d >= FENCE_FT && angle >= 18 && angle <= 50) {
    return { hit: true, bases: 4, label: 'home run' };
  }

  // Ground balls: low launch angle.
  if (angle < 10) {
    if (d < 55) return { hit: false, bases: 0, label: 'groundout' };
    return { hit: true, bases: 1, label: 'single' };
  }

  // Line drives — the ones that find the gaps.
  if (angle < 26) {
    if (d < 70) return { hit: false, bases: 0, label: 'lineout' };
    if (d < 230) return { hit: true, bases: 1, label: 'single' };
    if (d < 300) return { hit: true, bases: 2, label: 'double' };
    return { hit: true, bases: 3, label: 'triple' };
  }

  // Fly balls — run down in the air or banged off the wall.
  if (angle <= 50) {
    if (d < 280) return { hit: false, bases: 0, label: 'flyout' };
    return { hit: true, bases: 2, label: 'double' };
  }

  // Anything steeper is a pop-up.
  return { hit: false, bases: 0, label: 'popout' };
}

/**
 * Resolve one pitch. `swing` is `null` when the batter did not offer. `landing`
 * is required when `swing` is a contact swing and ignored otherwise.
 */
export function resolvePitch(
  swing: SwingJudgement | null,
  pitchInZone: boolean,
  landing: Landing | null = null,
): PitchOutcome {
  if (swing === null) {
    return pitchInZone ? { kind: 'called-strike' } : { kind: 'ball' };
  }

  if (swing.result === 'whiff') return { kind: 'swinging-strike' };
  if (swing.result === 'foul') return { kind: 'foul' };

  if (landing === null) {
    throw new Error('resolvePitch: a contact swing needs a landing');
  }
  return { kind: 'in-play', play: classifyBallInPlay(landing) };
}
