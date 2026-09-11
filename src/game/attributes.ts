/**
 * Player attributes and their effect on gameplay math — Phase 2's essential
 * path (see the Winslow queue). Deliberately minimal: three named attributes
 * on a 0..1 scale, each with one multiplier that hooks into an existing pure
 * module (`swing.ts` for power/contact, the runner animation for speed). No
 * accounts, create-a-player, or XP grind yet — a level is the only knob, and
 * `attributesForLevel` is what turns it into a felt difference.
 */

export interface Attributes {
  /** 0..1. Scales batted-ball exit velocity — feeds `swing.ts` `launchVelocity`. */
  power: number;
  /** 0..1. Widens/narrows the swing-timing window that still finds contact — feeds `swing.ts` `judgeSwing`. */
  contact: number;
  /** 0..1. Scales baserunning pace — feeds the runner animation speed. */
  speed: number;
}

/** An average player: every attribute at the midpoint, every multiplier at 1. */
export const BASELINE_ATTRIBUTES: Attributes = { power: 0.5, contact: 0.5, speed: 0.5 };

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 15;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Derive attributes from a level in [{@link MIN_LEVEL}, {@link MAX_LEVEL}].
 * Linear, and all three attributes move together for now (no per-attribute
 * builds yet — that's the create-a-player screen, deferred). The midpoint
 * level lands exactly on {@link BASELINE_ATTRIBUTES}, so "no level chosen"
 * and "an average level-8 player" feel identical.
 */
export function attributesForLevel(level: number): Attributes {
  const t = clamp01((level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL));
  const stat = 0.1 + t * 0.8; // level 1 -> 0.1, level 15 -> 0.9
  return { power: stat, contact: stat, speed: stat };
}

/** A stat's multiplier on its hooked-in gameplay number: 0..1 -> 0.6x..1.4x. */
function multiplierFromStat(stat: number): number {
  return 0.6 + clamp01(stat) * 0.8;
}

export function powerMultiplier(power: number): number {
  return multiplierFromStat(power);
}

export function contactMultiplier(contact: number): number {
  return multiplierFromStat(contact);
}

export function speedMultiplier(speed: number): number {
  return multiplierFromStat(speed);
}
