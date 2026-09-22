// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLanding } from './landing.ts';
import { ONBOARDING_STEPS, hasSeenOnboarding, markOnboardingSeen, memoryStorage } from './onboarding.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(storage = memoryStorage()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const landing = createLanding(host, { storage });
  const q = <T extends HTMLElement>(sel: string): T => {
    const el = host.querySelector<T>(sel);
    if (!el) throw new Error(`missing ${sel}`);
    return el;
  };
  return { host, landing, storage, q };
}

describe('createLanding', () => {
  it('mounts the intro card visible and the steps hidden', () => {
    const { q } = mount();
    expect(q('.landing-intro').hidden).toBe(false);
    expect(q('.landing-steps').hidden).toBe(true);
  });

  it('walks a first-time player through every step before starting', () => {
    const { landing, q, storage } = mount();
    const done = vi.fn();
    landing.onDone(done);

    q<HTMLButtonElement>('.landing-play').click();
    expect(q('.landing-steps').hidden).toBe(false);
    expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[0].title);
    expect(done).not.toHaveBeenCalled();

    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      q<HTMLButtonElement>('.landing-next').click();
      expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[i].title);
    }

    // On the last step the button becomes the finish action.
    expect(q('.landing-next').textContent).toBe('Start playing');
    q<HTMLButtonElement>('.landing-next').click();

    expect(done).toHaveBeenCalledTimes(1);
    expect(hasSeenOnboarding(storage)).toBe(true);
  });

  it('sends a returning player straight into the game', () => {
    const storage = memoryStorage();
    markOnboardingSeen(storage);
    const { landing, q } = mount(storage);
    const done = vi.fn();
    landing.onDone(done);

    q<HTMLButtonElement>('.landing-play').click();

    expect(done).toHaveBeenCalledTimes(1);
    expect(q('.landing-steps').hidden).toBe(true);
  });

  it('lets a first-time player skip the walkthrough', () => {
    const { landing, q, storage } = mount();
    const done = vi.fn();
    landing.onDone(done);

    q<HTMLButtonElement>('.landing-play').click();
    q<HTMLButtonElement>('.landing-skip').click();

    expect(done).toHaveBeenCalledTimes(1);
    expect(hasSeenOnboarding(storage)).toBe(true);
  });

  it('disables Back on the first step and re-enables it after Next', () => {
    const { q } = mount();
    q<HTMLButtonElement>('.landing-play').click();

    expect(q<HTMLButtonElement>('.landing-back').disabled).toBe(true);
    q<HTMLButtonElement>('.landing-next').click();
    expect(q<HTMLButtonElement>('.landing-back').disabled).toBe(false);

    q<HTMLButtonElement>('.landing-back').click();
    expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[0].title);
    expect(q<HTMLButtonElement>('.landing-back').disabled).toBe(true);
  });

  it('numbers the steps against the real script length', () => {
    const { q } = mount();
    q<HTMLButtonElement>('.landing-play').click();
    expect(q('.landing-progress').textContent).toBe(`Step 1 of ${ONBOARDING_STEPS.length}`);
  });

  it('replays the walkthrough on demand for a returning player', () => {
    const storage = memoryStorage();
    markOnboardingSeen(storage);
    const { landing, q } = mount(storage);
    const done = vi.fn();
    landing.onDone(done);

    landing.showHowToPlay();

    expect(q('.landing-steps').hidden).toBe(false);
    expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[0].title);
    expect(done).not.toHaveBeenCalled();
  });

  it('restarts the walkthrough from step one each time it is opened', () => {
    const { landing, q } = mount();
    q<HTMLButtonElement>('.landing-play').click();
    q<HTMLButtonElement>('.landing-next').click();
    expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[1].title);

    landing.showHowToPlay();
    expect(q('.landing-step-title').textContent).toBe(ONBOARDING_STEPS[0].title);
  });

  it('removes itself from the page on dispose', () => {
    const { host, landing } = mount();
    landing.dispose();
    expect(host.querySelector('.landing')).toBeNull();
  });
});
