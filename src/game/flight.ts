/**
 * Pure projectile motion for the batted ball. Constant gravity, no drag — enough
 * for the Phase 0 batter's box to read as a real hit. No Three.js, no DOM.
 *
 * Same coordinate space as {@link ./pitch.ts}: metres, home plate at the origin,
 * +z toward the mound, +y up, +x the batter's pull side.
 */

/** Downward acceleration in m/s^2. */
export const GRAVITY = 9.8;

/**
 * Position of a projectile launched from `origin` with `velocity` (m/s) after
 * `t` seconds. Negative `t` is treated as 0.
 */
export function projectilePosition(
  origin: readonly [number, number, number],
  velocity: readonly [number, number, number],
  t: number,
  gravity = GRAVITY,
): [number, number, number] {
  const s = t < 0 ? 0 : t;
  return [
    origin[0] + velocity[0] * s,
    origin[1] + velocity[1] * s - 0.5 * gravity * s * s,
    origin[2] + velocity[2] * s,
  ];
}
