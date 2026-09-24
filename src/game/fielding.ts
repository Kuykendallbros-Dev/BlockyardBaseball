/**
 * Fielding — turns a batted ball's landing spot into an out, a hit, or an
 * error by checking it against a real eight-fielder alignment.
 *
 * It now reports the batted-ball type alongside the result, because the
 * baserunning rules in `./inning.ts` need to know it: a ground ball with a
 * force on can become a double play, and a fly ball can score a runner from
 * third on a sacrifice. Errors are modelled too — a defence that never boots
 * one is not baseball.
 *
 * Pure: a `rand` in [0, 1) settles every borderline play.
 */

import type { Landing } from './atbat.ts';

export type HitLabel = 'single' | 'double' | 'triple' | 'home run';
export type OutLabel = 'groundout' | 'lineout' | 'flyout' | 'popout';
export type ErrorLabel = 'error';

/** How the ball came off the bat — drives the baserunning rules. */
export type BattedBallType = 'ground' | 'line' | 'fly' | 'popup';

export interface BallInPlay {
  hit: boolean;
  bases: 0 | 1 | 2 | 3 | 4;
  label: HitLabel | OutLabel | ErrorLabel;
  /** How the ball was struck. */
  battedBallType: BattedBallType;
  /** True when the batter reached because the defence misplayed it. */
  error: boolean;
}

/** Outfield fence distance, in feet. */
export const FENCE_FT = 330;

/**
 * Overall defensive proficiency. Kept as a coarse dial so existing callers
 * still work, but the numbers below are now calibrated against real outcomes
 * rather than picked to feel hard.
 */
export type FieldingDifficulty = 'easy' | 'medium' | 'hard';

/** Multiplier on every fielder's reach, by difficulty. */
const PROFICIENCY: Record<FieldingDifficulty, number> = {
  easy: 1.0,
  medium: 1.25,
  hard: 1.5,
};

/**
 * Chance a routine play is booted. Roughly one error every other game per
 * side, which is where real baseball sits.
 */
const ERROR_RATE = 0.012;

/**
 * Width, in feet, of the band around a fielder's reach where the play is a
 * coin flip. Smaller = more decisive plays and a lower BABIP.
 */
const DECISION_BAND_FT = 26;

/**
 * Baseline share of balls in play the defence converts into outs, before
 * geometry. Tuned so a full nine-inning game lands near a real box score
 * instead of running to fifty runs a side.
 */
const CONVERSION_FLOOR = 0.45;

/**
 * How far the nearest outfielder has to be, in feet, for a ball that lands in
 * front of him to go for extra bases rather than a single.
 */
const ALLEY_GAP_FT = 46;

interface Fielder {
  bearingDeg: number;
  distanceFt: number;
  /** Range in feet at which this fielder reliably makes the play. */
  reach: number;
  infield: boolean;
}

const FIELDERS: readonly Fielder[] = [
  { bearingDeg: 0, distanceFt: 60, reach: 12, infield: true }, // pitcher
  { bearingDeg: 33, distanceFt: 90, reach: 16, infield: true }, // 1B
  { bearingDeg: 13, distanceFt: 145, reach: 19, infield: true }, // 2B
  { bearingDeg: -13, distanceFt: 145, reach: 19, infield: true }, // SS
  { bearingDeg: -33, distanceFt: 90, reach: 16, infield: true }, // 3B
  // Shallow outfielders close the old mid-range coverage hole rather than a
  // blanket reach multiplier, which used to catch deep balls too.
  // Outfield reach is deliberately smaller than the spacing between them, so
  // the alleys are real: a ball into the gap is a double, not a routine catch.
  { bearingDeg: -26, distanceFt: 248, reach: 40, infield: false }, // LF
  { bearingDeg: 0, distanceFt: 278, reach: 44, infield: false }, // CF
  { bearingDeg: 26, distanceFt: 248, reach: 40, infield: false }, // RF
];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function toXZ(bearingDeg: number, distanceFt: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  return [distanceFt * Math.sin(b), distanceFt * Math.cos(b)];
}

function battedBallTypeFor(angle: number): BattedBallType {
  if (angle < 10) return 'ground';
  if (angle < 24) return 'line';
  if (angle <= 55) return 'fly';
  return 'popup';
}

const OUT_LABEL: Record<BattedBallType, OutLabel> = {
  ground: 'groundout',
  line: 'lineout',
  fly: 'flyout',
  popup: 'popout',
};

/**
 * Resolve a ball in play. `rand` decides the borderline plays; it defaults to
 * a coin-flip midpoint so the pure classification is deterministic in tests.
 * `difficulty` scales every fielder's reach — see {@link FieldingDifficulty}.
 */
export function fieldBallInPlay(
  landing: Landing,
  rand: () => number = () => 0.5,
  difficulty: FieldingDifficulty = 'hard',
): BallInPlay {
  const { distanceFt: d, launchAngleDeg: angle, bearingDeg } = landing;
  const battedBallType = battedBallTypeFor(angle);

  if (d >= FENCE_FT && angle >= 16 && angle <= 50) {
    return { hit: true, bases: 4, label: 'home run', battedBallType, error: false };
  }
  if (battedBallType === 'popup') {
    return reachedOnErrorOr(
      { hit: false, bases: 0, label: 'popout', battedBallType, error: false },
      battedBallType,
      rand,
    );
  }

  const grounder = battedBallType === 'ground';
  const liner = battedBallType === 'line';
  const [bx, bz] = toXZ(bearingDeg, d);
  const proficiency = PROFICIENCY[difficulty];

  let bestCatch = 0;
  // Distance from the nearest outfielder — how far into the alley it landed.
  // This is what separates a single from a double far better than raw carry.
  let outfieldGap = Infinity;
  for (const f of FIELDERS) {
    if (grounder && !f.infield) continue; // outfielders don't "catch" grounders
    const [fx, fz] = toXZ(f.bearingDeg, f.distanceFt);
    const gap = Math.hypot(bx - fx, bz - fz);
    if (!f.infield) outfieldGap = Math.min(outfieldGap, gap);

    let reach = f.reach * proficiency;
    if (grounder && f.infield) reach *= 1.2;
    else if (liner) reach *= 0.85;
    else if (!grounder && f.infield) reach *= 0.7; // shallow fly only

    bestCatch = Math.max(
      bestCatch,
      clamp01((reach - gap) / DECISION_BAND_FT + 0.5),
    );
  }

  // Lift the whole curve so the defence converts balls in play at roughly the
  // real-world rate. Without this the geometry alone leaves huge gaps and
  // every game runs to a football score.
  bestCatch = CONVERSION_FLOOR + (1 - CONVERSION_FLOOR) * bestCatch;

  if (rand() < bestCatch) {
    return reachedOnErrorOr(
      { hit: false, bases: 0, label: OUT_LABEL[battedBallType], battedBallType, error: false },
      battedBallType,
      rand,
    );
  }

  // Got through — how far did it get? A ground ball through the infield is a
  // single; in the air it depends on how much ground the outfielder has to
  // cover before he can pick it up.
  if (grounder) {
    return { hit: true, bases: 1, label: 'single', battedBallType, error: false };
  }
  if (d >= FENCE_FT) {
    // Deep, but the wrong angle for a home run — off the wall for three.
    return { hit: true, bases: 3, label: 'triple', battedBallType, error: false };
  }
  if (d >= 200 && outfieldGap > ALLEY_GAP_FT) {
    // Into the alley. A really deep one rolls to the wall.
    return d > 290 && rand() < 0.16
      ? { hit: true, bases: 3, label: 'triple', battedBallType, error: false }
      : { hit: true, bases: 2, label: 'double', battedBallType, error: false };
  }
  return { hit: true, bases: 1, label: 'single', battedBallType, error: false };
}

/** Convert a would-be out into an error at {@link ERROR_RATE}. */
function reachedOnErrorOr(
  out: BallInPlay,
  battedBallType: BattedBallType,
  rand: () => number,
): BallInPlay {
  if (rand() >= ERROR_RATE) return out;
  return { hit: false, bases: 1, label: 'error', battedBallType, error: true };
}
