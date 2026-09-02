/**
 * Pure pitch trajectory. The ball travels from the pitcher's release point to
 * the front of the strike zone along a shallow lob. No Three.js, no DOM — just
 * math, so the flight path can be unit-tested.
 *
 * Coordinate space (metres): home plate at the origin, +z points toward the
 * mound, +y is up, +x is the batter's pull side.
 */

export const RELEASE_POINT: readonly [number, number, number] = [0, 2.0, 18];
export const PLATE_POINT: readonly [number, number, number] = [0, 1.0, 0.6];

/** Seconds from release until the ball reaches the plate. */
export const PITCH_DURATION = 1.35;

/** Extra height added at mid-flight to make the pitch read as a lob. */
const ARC_HEIGHT = 1.1;

/**
 * Ball position at flight fraction `u` (0 = release, 1 = the target). Values
 * outside [0, 1] are clamped, so callers can pass raw elapsed/duration.
 *
 * `target` defaults to {@link PLATE_POINT} (a pitch straight down the middle).
 * `lateBreak` adds movement that grows with the square of the flight fraction,
 * so it barely shows early and snaps in near the plate — `[x, y]` in metres.
 */
export function ballPositionAt(
  u: number,
  target: readonly [number, number, number] = PLATE_POINT,
  lateBreak: readonly [number, number] = [0, 0],
): [number, number, number] {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  const [x0, y0, z0] = RELEASE_POINT;
  const [x1, y1, z1] = target;

  const x = x0 + (x1 - x0) * t + lateBreak[0] * t * t;
  const z = z0 + (z1 - z0) * t;
  // straight-line height plus a parabola that is 0 at the ends, max at t = 0.5
  const y = y0 + (y1 - y0) * t + ARC_HEIGHT * 4 * t * (1 - t) + lateBreak[1] * t * t;

  return [x, y, z];
}
