/**
 * Pure AI for the computer side — a batter's swing decision and timing, plus the
 * pitcher's location intent from the count. One baseline difficulty. No
 * rendering; the scene turns a decision into an auto-swing at the right moment.
 */

import type { HalfInningState } from './inning.ts';

export interface BatterAI {
  /** Chance of swinging at a pitch outside the zone. */
  chaseRate: number;
  /** Chance of swinging at a pitch in the zone. */
  zoneSwingRate: number;
  /** Spread of the swing's timing error, in seconds. */
  timingSigma: number;
  /** 0..1 — higher trims timing error toward solid contact. */
  power: number;
}

export const LEAGUE_AVERAGE_BATTER: BatterAI = {
  chaseRate: 0.28,
  zoneSwingRate: 0.66,
  timingSigma: 0.12,
  power: 0.5,
};

export interface BatterDecision {
  swing: boolean;
  /** Timing error in seconds when swinging; negative = early. */
  timingError: number;
}

/** Decide the AI batter's action against one pitch. `rand` returns [0, 1). */
export function batterDecision(
  ai: BatterAI,
  inZone: boolean,
  rand: () => number,
): BatterDecision {
  const swingProb = inZone ? ai.zoneSwingRate : ai.chaseRate;
  if (rand() >= swingProb) return { swing: false, timingError: 0 };

  // Sum of three uniforms ~ a bell around 0, range [-1.5, 1.5].
  const bell = rand() + rand() + rand() - 1.5;
  const spread = ai.timingSigma * (1.5 - ai.power * 0.6);
  return { swing: true, timingError: bell * spread };
}

/**
 * The pitcher's location intent from the count: groove one when behind 3-0,
 * expand the zone chasing a strikeout with two strikes, otherwise neutral.
 * Feeds `rollPitch`'s `zoneBias`.
 */
export function zoneBiasForCount(state: HalfInningState): number {
  if (state.balls >= 3) return 0.28;
  if (state.strikes >= 2 && state.balls <= 1) return -0.22;
  return 0;
}
