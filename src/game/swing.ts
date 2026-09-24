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
  perfect: 0.03,
  solid: 0.085,
  contact: 0.115,
  foul: 0.19,
} as const;

/**
 * `contactMultiplier` (default 1, an average `contact` attribute) scales how
 * forgiving the timing windows are: above 1 widens them, below 1 narrows
 * them. See `game/attributes.ts`.
 */
export function judgeSwing(
  errorSeconds: number,
  contactMultiplier = 1,
): SwingJudgement {
  const e = Math.abs(errorSeconds) / contactMultiplier;
  if (e <= WINDOWS.perfect) return { result: 'contact', quality: 'perfect' };
  if (e <= WINDOWS.solid) return { result: 'contact', quality: 'solid' };
  if (e <= WINDOWS.contact) return { result: 'contact', quality: 'weak' };
  if (e <= WINDOWS.foul) return { result: 'foul', quality: null };
  return { result: 'whiff', quality: null };
}

/** Exit speed, m/s, of a ball squared up dead centre. */
const MAX_EXIT_SPEED = 40;
/** Exit speed, m/s, of a ball at the very edge of the contact window. */
const MIN_EXIT_SPEED = 15;

/**
 * How well the ball was barrelled, 0..1, from the timing error alone. This is
 * the single number both exit speed and launch angle hang off, which is why a
 * mistimed swing now dribbles one to short instead of leaving the yard.
 */
function barrel(errorSeconds: number): number {
  const t = 1 - Math.abs(errorSeconds) / WINDOWS.contact;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Launch angle in degrees. Timing sets the centre of the window — roll over an
 * early swing and you beat it into the ground, get under a late one and you pop
 * it up — and `rand` supplies the bat-plane variation that decides whether a
 * well-struck ball is a line drive or a ball in the seats. Without that
 * variation every squared-up swing produced exactly the same trajectory, which
 * is what used to make every barrel a home run.
 */
function launchAngleDeg(errorSeconds: number, rand: () => number): number {
  const tilt = (errorSeconds / WINDOWS.contact) * 24;
  const jitter = (rand() + rand() - 1) * 15;
  const angle = 13 + tilt + jitter;
  return angle < -8 ? -8 : angle > 62 ? 62 : angle;
}

/**
 * Batted-ball velocity (m/s) for a contact swing. The ball travels out toward
 * the outfield (+z, past the mound); earlier contact pulls it toward +x, later
 * contact pushes it toward -x. `errorSeconds` negative = early.
 * `powerMultiplier` (default 1, an average `power` attribute) scales exit speed
 * — see `game/attributes.ts`. `rand` in [0, 1) supplies launch-angle variation
 * and defaults to a deterministic midpoint so tests stay reproducible.
 */
export function launchVelocity(
  errorSeconds: number,
  quality: ContactQuality,
  powerMultiplier = 1,
  rand: () => number = () => 0.5,
): [number, number, number] {
  const b = barrel(errorSeconds);
  // Quality is the label the HUD shows; barrel is what the physics uses. They
  // agree by construction, since both come from the same timing error.
  void quality;
  const speed =
    (MIN_EXIT_SPEED + (MAX_EXIT_SPEED - MIN_EXIT_SPEED) * Math.pow(b, 1.45)) *
    powerMultiplier;
  const angle = (launchAngleDeg(errorSeconds, rand) * Math.PI) / 180;

  // Spray angle. The range runs past the foul lines on purpose: pulling a ball
  // hard enough to hook it foul is a normal outcome, and `atbat.ts` turns
  // anything outside the lines into a foul ball rather than a fair one.
  const spray = Math.max(-0.95, Math.min(0.95, -errorSeconds * 2.6));

  const horizontal = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);
  const vx = horizontal * Math.sin(spray);
  const vz = horizontal * Math.cos(spray); // toward the outfield (+z, past the mound)

  return [vx, vy, vz];
}
