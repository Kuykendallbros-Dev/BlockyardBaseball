/**
 * Arcade fielding — turns a batted ball's landing spot into an out or a hit by
 * checking it against a fixed defensive alignment. Still "arcade": no throws,
 * relays, or errors, and a `rand` in [0, 1) settles the in-between plays. Pure.
 */

import type { Landing } from './atbat.ts';

export type HitLabel = 'single' | 'double' | 'triple' | 'home run';
export type OutLabel = 'groundout' | 'lineout' | 'flyout' | 'popout';

export interface BallInPlay {
  hit: boolean;
  bases: 0 | 1 | 2 | 3 | 4;
  label: HitLabel | OutLabel;
}

/** Outfield fence distance, in feet. */
export const FENCE_FT = 330;

/**
 * Overall defensive proficiency. A stand-in for player attributes/skills
 * (Phase 2) — for now a coarse three-step dial rather than per-fielder stats.
 */
export type FieldingDifficulty = 'easy' | 'medium' | 'hard';

/** Multiplier on every fielder's reach, by difficulty. */
const PROFICIENCY: Record<FieldingDifficulty, number> = {
  easy: 1,
  medium: 1.35,
  hard: 1.7,
};

interface Fielder {
  bearingDeg: number;
  distanceFt: number;
  /** Range in feet at which this fielder reliably makes the play. */
  reach: number;
  infield: boolean;
}

const FIELDERS: readonly Fielder[] = [
  { bearingDeg: 0, distanceFt: 60, reach: 10, infield: true }, // pitcher
  { bearingDeg: 33, distanceFt: 90, reach: 13, infield: true }, // 1B
  { bearingDeg: 13, distanceFt: 145, reach: 15, infield: true }, // 2B
  { bearingDeg: -13, distanceFt: 145, reach: 15, infield: true }, // SS
  { bearingDeg: -33, distanceFt: 90, reach: 13, infield: true }, // 3B
  { bearingDeg: -26, distanceFt: 285, reach: 40, infield: false }, // LF
  { bearingDeg: 0, distanceFt: 320, reach: 46, infield: false }, // CF
  { bearingDeg: 26, distanceFt: 285, reach: 40, infield: false }, // RF
];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function toXZ(bearingDeg: number, distanceFt: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  return [distanceFt * Math.sin(b), distanceFt * Math.cos(b)];
}

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

  if (d >= FENCE_FT && angle >= 16 && angle <= 50) {
    return { hit: true, bases: 4, label: 'home run' };
  }
  if (angle > 55) {
    return { hit: false, bases: 0, label: 'popout' };
  }

  const grounder = angle < 10;
  const liner = angle >= 10 && angle < 24;
  const [bx, bz] = toXZ(bearingDeg, d);
  const proficiency = PROFICIENCY[difficulty];

  let bestCatch = 0;
  for (const f of FIELDERS) {
    if (grounder && !f.infield) continue; // outfielders don't "catch" grounders
    const [fx, fz] = toXZ(f.bearingDeg, f.distanceFt);
    const gap = Math.hypot(bx - fx, bz - fz);

    let reach = f.reach * proficiency;
    if (grounder && f.infield) reach *= 1.15;
    else if (liner) reach *= 0.8;
    else if (angle >= 24 && f.infield) reach *= 0.5; // shallow fly only

    bestCatch = Math.max(bestCatch, clamp01((reach - gap) / 16 + 0.5));
  }

  // Tracy's direct call, 2026-09-14: halve the hit rate on any ball that
  // reaches the probabilistic catch check (not the deterministic HR/popout
  // cases above). Still a placeholder pending attribute-driven fielding.
  const HIT_PROBABILITY_MULTIPLIER = 0.5;
  bestCatch = 1 - (1 - bestCatch) * HIT_PROBABILITY_MULTIPLIER;

  if (rand() < bestCatch) {
    if (grounder) return { hit: false, bases: 0, label: 'groundout' };
    if (liner) return { hit: false, bases: 0, label: 'lineout' };
    return { hit: false, bases: 0, label: 'flyout' };
  }

  // Got through — how far did it get?
  if (grounder) return { hit: true, bases: 1, label: 'single' };
  if (d < 250) return { hit: true, bases: 1, label: 'single' };
  if (d >= FENCE_FT) return { hit: true, bases: 3, label: 'triple' }; // deep, wrong angle for a HR
  return rand() < 0.3
    ? { hit: true, bases: 3, label: 'triple' }
    : { hit: true, bases: 2, label: 'double' };
}
