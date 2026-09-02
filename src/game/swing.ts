/**
 * Pure swing resolution. Given how far off the swing was from the ideal contact
 * moment (in seconds, negative = early, positive = late), decide the outcome and
 * — on contact — the batted-ball velocity. No rendering here.
 */

export type SwingResult = 'whiff' | 'foul' | 'contact';
export type ContactQuality = 'perfect' | 'solid' | 'weak';

export interface SwingJudgement {
  result: SwingResult;
  /** Only set when `result` is 'contact'. */
  quality: ContactQuality | null;
}

/** Absolute timing error thresholds, in seconds. */
export const WINDOWS = {
  perfect: 0.04,
  solid: 0.09,
  contact: 0.14,
  foul: 0.22,
} as const;

export function judgeSwing(errorSeconds: number): SwingJudgement {
  const e = Math.abs(errorSeconds);
  if (e <= WINDOWS.perfect) return { result: 'contact', quality: 'perfect' };
  if (e <= WINDOWS.solid) return { result: 'contact', quality: 'solid' };
  if (e <= WINDOWS.contact) return { result: 'contact', quality: 'weak' };
  if (e <= WINDOWS.foul) return { result: 'foul', quality: null };
  return { result: 'whiff', quality: null };
}

const EXIT_SPEED: Record<ContactQuality, number> = {
  perfect: 38,
  solid: 28,
  weak: 15,
};

/**
 * Launch angle in degrees for a contact swing. A clean hit drives the ball on a
 * carrying line; a weak hit is a grounder when you roll over an early swing and
 * a lazy pop-up when you get under a late one.
 */
function launchAngleDeg(errorSeconds: number, quality: ContactQuality): number {
  if (quality === 'perfect') return 26;
  if (quality === 'solid') return 20;
  return errorSeconds < 0 ? 7 : 44;
}

/**
 * Batted-ball velocity (m/s) for a contact swing. The ball travels out toward
 * the outfield (+z, past the mound); earlier contact pulls it toward +x, later
 * contact pushes it toward -x. Quality drives launch angle and speed.
 * `errorSeconds` negative = early.
 */
export function launchVelocity(
  errorSeconds: number,
  quality: ContactQuality,
): [number, number, number] {
  const speed = EXIT_SPEED[quality];
  const angle = (launchAngleDeg(errorSeconds, quality) * Math.PI) / 180;

  // spray: -0.35s..+0.35s of error maps to roughly -35deg..+35deg of pull/push
  const spray = Math.max(-0.6, Math.min(0.6, -errorSeconds * 1.8));

  const horizontal = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);
  const vx = horizontal * Math.sin(spray);
  const vz = horizontal * Math.cos(spray); // toward the outfield (+z, past the mound)

  return [vx, vy, vz];
}
