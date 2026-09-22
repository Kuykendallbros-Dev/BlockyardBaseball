/**
 * First-run state and the how-to-play script (P6-1). Pure: no DOM, no
 * `localStorage` reference of its own — the caller injects storage, which is
 * what lets this be tested directly and what keeps a blocked or unavailable
 * `localStorage` (private browsing, embedded webviews) from throwing on load.
 *
 * `landing.ts` renders this; the split exists so the "has this player been
 * here before, and what should they be shown" decision is testable without a
 * browser.
 */

/** The slice of `Storage` used here. Anything key/value shaped will do. */
export interface OnboardingStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
 * Bumping this re-runs onboarding for everyone — use it when the controls
 * actually change, not for copy edits.
 */
export const ONBOARDING_VERSION = 1;

export const STORAGE_KEY = 'blockyard.onboarding';

export interface OnboardingStep {
  title: string;
  body: string;
}

/**
 * The how-to-play script, in order. Deliberately short: three steps a player
 * reads in about fifteen seconds, covering only what they cannot discover by
 * pressing a key.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    title: 'Pick your spot',
    body: 'Before the pitch, click a tile in the strike zone to say where you think it is going. Once the ball is released you get exactly one chance to move — after that your pick is locked.',
  },
  {
    title: 'Time the swing',
    body: 'Press space to swing. Contact is all about timing: swing as the ball reaches the plate. Too early or too late and you will foul it off or miss entirely.',
  },
  {
    title: 'Play someone real',
    body: 'Quick Play puts you against the computer for nine innings. Play Online queues you against another person, and the result moves your rating.',
  },
];

/**
 * A storage that forgets everything. Used when the real one is unavailable so
 * the page still loads — the cost is that onboarding shows every visit, which
 * is far better than a blank screen.
 */
export function memoryStorage(): OnboardingStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/**
 * `window.localStorage` if it is actually usable, otherwise an in-memory
 * stand-in. Merely reading `localStorage` throws in some privacy modes, so
 * the probe is a real write inside a try.
 */
export function browserStorage(): OnboardingStorage {
  try {
    const probe = '__blockyard_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

/**
 * Has this player already completed onboarding at the current version? A
 * stored value from an older version counts as not seen, so a controls change
 * re-teaches it.
 */
export function hasSeenOnboarding(storage: OnboardingStorage): boolean {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return false;
  const seen = Number.parseInt(raw, 10);
  if (Number.isNaN(seen)) return false;
  return seen >= ONBOARDING_VERSION;
}

/** Record that onboarding is done, so it does not show again. */
export function markOnboardingSeen(storage: OnboardingStorage): void {
  storage.setItem(STORAGE_KEY, String(ONBOARDING_VERSION));
}

export interface Stepper {
  index: () => number;
  current: () => OnboardingStep;
  /** True when the current step is the last one. */
  isLast: () => boolean;
  /** Advance if possible; returns false when already on the last step. */
  next: () => boolean;
  /** Step back if possible; returns false when already on the first step. */
  back: () => boolean;
}

/** Walk the onboarding steps, clamped at both ends. */
export function createStepper(steps: readonly OnboardingStep[] = ONBOARDING_STEPS): Stepper {
  if (steps.length === 0) throw new Error('onboarding: needs at least one step');
  let i = 0;
  return {
    index: () => i,
    current: () => steps[i],
    isLast: () => i === steps.length - 1,
    next: () => {
      if (i >= steps.length - 1) return false;
      i += 1;
      return true;
    },
    back: () => {
      if (i === 0) return false;
      i -= 1;
      return true;
    },
  };
}
