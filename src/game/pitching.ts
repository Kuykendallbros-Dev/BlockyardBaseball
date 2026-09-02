/**
 * Pure pitch selection — type, speed, location, and late movement. Given a
 * random source it rolls the next pitch; the scene turns that into a flight path
 * with `ballPositionAt` and the batter's timing window follows from
 * `pitch.duration`. No rendering, no AI strategy (that is P1-7) — just the shape
 * of one pitch.
 */

import { PITCH_DURATION, PLATE_POINT } from './pitch.ts';

/** Half-width and half-height of the strike zone at the plate, in metres. */
export const ZONE_HALF_WIDTH = 0.45;
export const ZONE_HALF_HEIGHT = 0.55;

export type PitchType = 'fastball' | 'breaking' | 'changeup';

export interface Pitch {
  type: PitchType;
  /** Flight time in seconds, already scaled for pitch speed. */
  duration: number;
  /** Aim point relative to the strike-zone centre, in metres `[x, y]`. */
  location: readonly [number, number];
  /** Late movement over the flight, in metres `[x, y]`. */
  lateBreak: readonly [number, number];
  /** Where the ball actually crosses the plate: `location + lateBreak`. */
  crossing: readonly [number, number];
  /** Whether the crossing point is inside the strike zone. */
  inZone: boolean;
}

export function isInZone(point: readonly [number, number]): boolean {
  return (
    Math.abs(point[0]) <= ZONE_HALF_WIDTH && Math.abs(point[1]) <= ZONE_HALF_HEIGHT
  );
}

/** Absolute plate target (3D) for a pitch aim point. */
export function plateTarget(
  location: readonly [number, number],
): [number, number, number] {
  return [PLATE_POINT[0] + location[0], PLATE_POINT[1] + location[1], PLATE_POINT[2]];
}

interface TypeProfile {
  weight: number;
  /** Duration multiplier range `[min, max]`. */
  speed: readonly [number, number];
  /** Late-break magnitude `[x, y]`; x is signed toward the aim side. */
  movement: readonly [number, number];
}

const PROFILES: Record<PitchType, TypeProfile> = {
  fastball: { weight: 0.5, speed: [0.82, 0.9], movement: [0, 0] },
  breaking: { weight: 0.3, speed: [0.98, 1.06], movement: [0.35, -0.22] },
  changeup: { weight: 0.2, speed: [1.12, 1.24], movement: [0, -0.16] },
};

const ORDER: readonly PitchType[] = ['fastball', 'breaking', 'changeup'];
const ZONE_TARGET_RATE = 0.62;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Roll the next pitch. `rand` must return values in [0, 1). */
export function rollPitch(rand: () => number = Math.random): Pitch {
  let roll = rand();
  let type: PitchType = 'fastball';
  for (const name of ORDER) {
    if (roll < PROFILES[name].weight) {
      type = name;
      break;
    }
    roll -= PROFILES[name].weight;
  }

  const profile = PROFILES[type];
  const duration = PITCH_DURATION * lerp(profile.speed[0], profile.speed[1], rand());

  const aimZone = rand() < ZONE_TARGET_RATE;
  const spanX = ZONE_HALF_WIDTH * (aimZone ? 0.8 : 1.7);
  const spanY = ZONE_HALF_HEIGHT * (aimZone ? 0.8 : 1.7);
  const location: [number, number] = [
    (rand() * 2 - 1) * spanX,
    (rand() * 2 - 1) * spanY,
  ];

  const breakDir = location[0] >= 0 ? 1 : -1;
  const lateBreak: [number, number] = [
    profile.movement[0] * breakDir,
    profile.movement[1],
  ];
  const crossing: [number, number] = [
    location[0] + lateBreak[0],
    location[1] + lateBreak[1],
  ];

  return { type, duration, location, lateBreak, crossing, inZone: isInZone(crossing) };
}
