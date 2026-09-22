import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  STORAGE_KEY,
  createStepper,
  hasSeenOnboarding,
  markOnboardingSeen,
  memoryStorage,
} from './onboarding.ts';

describe('onboarding first-run state', () => {
  it('treats a player with no stored value as new', () => {
    expect(hasSeenOnboarding(memoryStorage())).toBe(false);
  });

  it('remembers a completed run', () => {
    const storage = memoryStorage();
    markOnboardingSeen(storage);
    expect(hasSeenOnboarding(storage)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(String(ONBOARDING_VERSION));
  });

  it('re-runs onboarding for a player stuck on an older version', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, String(ONBOARDING_VERSION - 1));
    expect(hasSeenOnboarding(storage)).toBe(false);
  });

  it('does not re-run for a player on a newer version than this build', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, String(ONBOARDING_VERSION + 1));
    expect(hasSeenOnboarding(storage)).toBe(true);
  });

  it('treats a corrupted stored value as never seen rather than throwing', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, 'not-a-number');
    expect(hasSeenOnboarding(storage)).toBe(false);
  });

  it('survives a storage that throws on write, via the memory fallback', () => {
    // memoryStorage is what browserStorage falls back to; prove it is a
    // working storage in its own right so the fallback path is not a stub.
    const storage = memoryStorage();
    expect(() => markOnboardingSeen(storage)).not.toThrow();
    expect(hasSeenOnboarding(storage)).toBe(true);
  });
});

describe('createStepper', () => {
  it('starts on the first step', () => {
    const stepper = createStepper();
    expect(stepper.index()).toBe(0);
    expect(stepper.current()).toBe(ONBOARDING_STEPS[0]);
  });

  it('walks forward to the last step and stops', () => {
    const stepper = createStepper();
    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      expect(stepper.next()).toBe(true);
      expect(stepper.index()).toBe(i);
    }
    expect(stepper.isLast()).toBe(true);
    expect(stepper.next()).toBe(false);
    expect(stepper.index()).toBe(ONBOARDING_STEPS.length - 1);
  });

  it('walks back to the first step and stops', () => {
    const stepper = createStepper();
    stepper.next();
    expect(stepper.back()).toBe(true);
    expect(stepper.index()).toBe(0);
    expect(stepper.back()).toBe(false);
    expect(stepper.index()).toBe(0);
  });

  it('reports isLast only on the final step', () => {
    const steps = [
      { title: 'a', body: 'a' },
      { title: 'b', body: 'b' },
    ];
    const stepper = createStepper(steps);
    expect(stepper.isLast()).toBe(false);
    stepper.next();
    expect(stepper.isLast()).toBe(true);
  });

  it('handles a single-step script as immediately last', () => {
    const stepper = createStepper([{ title: 'only', body: 'only' }]);
    expect(stepper.isLast()).toBe(true);
    expect(stepper.next()).toBe(false);
    expect(stepper.back()).toBe(false);
  });

  it('refuses an empty script rather than rendering nothing', () => {
    expect(() => createStepper([])).toThrow(/at least one step/);
  });

  it('ships a script short enough to actually be read', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThan(0);
    expect(ONBOARDING_STEPS.length).toBeLessThanOrEqual(4);
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeLessThanOrEqual(240);
    }
  });
});
