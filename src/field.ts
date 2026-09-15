/**
 * Field geometry shared by the scene and the runner animation. A diamond scaled
 * down from real dimensions so all four bases read at once from the fixed camera
 * behind home plate. Same coordinate space as `game/pitch.ts` (+z toward the
 * mound and the outfield).
 */

export type Vec3 = readonly [number, number, number];

export const HOME: Vec3 = [0, 0.06, 0.4];
// The fixed camera behind home plate is mirrored left/right on screen from a
// naive +x-is-right assumption (its lookAt flips handedness) — first and
// third are swapped here, not in the camera, so runners visibly go home ->
// first (screen right) -> second -> third (screen left) -> home, matching
// real baseball as seen from behind the plate.
export const FIRST: Vec3 = [-3.4, 0.06, 3.8];
export const SECOND: Vec3 = [0, 0.06, 7.2];
export const THIRD: Vec3 = [3.4, 0.06, 3.8];

/** Indexed 0 = home, 1 = first, 2 = second, 3 = third. */
export const BASES: readonly Vec3[] = [HOME, FIRST, SECOND, THIRD];
