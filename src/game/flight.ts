/**
 * Pure projectile motion for the batted ball. Constant gravity, no drag — enough
 * for the Phase 0 batter's box to read as a real hit. No Three.js, no DOM.
 *
 * Same coordinate space as {@link ./pitch.ts}: metres, home plate at the origin,
 * +z toward the mound, +y up, +x the batter's pull side.
 */

/** Downward acceleration in m/s^2. */
export const GRAVITY = 9.8;

/** Metres to feet, for the carry-distance readout. */
export const METRES_TO_FEET = 3.28084;

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

/**
 * Seconds until a projectile launched from height `y0` with vertical velocity
 * `vy` falls back to y = 0. Returns 0 if it starts at or below ground with no
 * upward push.
 */
export function timeToGround(y0: number, vy: number, gravity = GRAVITY): number {
  const disc = vy * vy + 2 * gravity * y0;
  if (disc <= 0) return 0;
  return (vy + Math.sqrt(disc)) / gravity;
}

/**
 * Horizontal ground distance (metres) a batted ball carries from `origin` with
 * `velocity` before it lands.
 */
export function carryDistance(
  origin: readonly [number, number, number],
  velocity: readonly [number, number, number],
  gravity = GRAVITY,
): number {
  const t = timeToGround(origin[1], velocity[1], gravity);
  const end = projectilePosition(origin, velocity, t, gravity);
  return Math.hypot(end[0] - origin[0], end[2] - origin[2]);
}
