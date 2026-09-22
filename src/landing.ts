/**
 * The landing page and first-run how-to-play (P6-1) — the first thing an
 * unknown visitor sees, layered over the 3D scene while it loads behind.
 *
 * Two panels, one after the other:
 *   1. Landing — what the game is and a single "Play" call to action.
 *   2. How to play — the three-step script from `onboarding.ts`, shown only
 *      to first-time players and skippable. Returning players go straight
 *      from Play to the game menu.
 *
 * All decision logic lives in `onboarding.ts` and is tested there; this file
 * is the DOM.
 */

import {
  ONBOARDING_STEPS,
  type OnboardingStorage,
  type Stepper,
  browserStorage,
  createStepper,
  hasSeenOnboarding,
  markOnboardingSeen,
} from './onboarding.ts';

export interface Landing {
  readonly element: HTMLElement;
  /** Show the landing panel again (used by the menu's "How to play" link). */
  show: () => void;
  hide: () => void;
  /**
   * Replay the how-to-play steps on demand, regardless of whether this player
   * has seen them before.
   */
  showHowToPlay: () => void;
  /** Fired once the player has finished the landing (and onboarding, if shown). */
  onDone: (handler: () => void) => void;
  dispose: () => void;
}

export interface LandingOptions {
  /** Defaults to `localStorage` with an in-memory fallback. */
  storage?: OnboardingStorage;
}

export function createLanding(container: HTMLElement, options: LandingOptions = {}): Landing {
  const storage = options.storage ?? browserStorage();

  const root = document.createElement('div');
  root.className = 'landing';
  root.innerHTML = `
    <div class="landing-card landing-intro">
      <h1 class="landing-title">Blockyard Baseball</h1>
      <p class="landing-tagline">Nine innings of backyard baseball. Read the pitch, time the swing, take it online.</p>
      <ul class="landing-points">
        <li>Call your spot in the strike zone before the pitch</li>
        <li>Level up, buy gear, work a battle pass</li>
        <li>Queue against a real opponent and move your rating</li>
      </ul>
      <button class="landing-play" type="button">Play</button>
      <button class="landing-how" type="button">How to play</button>
    </div>

    <div class="landing-card landing-steps" hidden>
      <p class="landing-progress"></p>
      <h2 class="landing-step-title"></h2>
      <p class="landing-step-body"></p>
      <div class="landing-step-actions">
        <button class="landing-back" type="button">Back</button>
        <button class="landing-next" type="button">Next</button>
      </div>
      <button class="landing-skip" type="button">Skip</button>
    </div>
  `;
  container.appendChild(root);

  /**
   * Query one required element. The markup above is a literal in this file,
   * so a miss is a typo, not a runtime condition — failing loudly beats
   * rendering a landing page with a dead button.
   */
  function need<T extends HTMLElement>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`landing: markup missing ${selector}`);
    return el;
  }

  const intro = need<HTMLElement>('.landing-intro');
  const steps = need<HTMLElement>('.landing-steps');
  const playButton = need<HTMLButtonElement>('.landing-play');
  const howButton = need<HTMLButtonElement>('.landing-how');
  const progress = need<HTMLElement>('.landing-progress');
  const stepTitle = need<HTMLElement>('.landing-step-title');
  const stepBody = need<HTMLElement>('.landing-step-body');
  const backButton = need<HTMLButtonElement>('.landing-back');
  const nextButton = need<HTMLButtonElement>('.landing-next');
  const skipButton = need<HTMLButtonElement>('.landing-skip');

  let handler: () => void = () => {};
  let stepper: Stepper = createStepper();

  function renderStep(): void {
    const step = stepper.current();
    progress.textContent = `Step ${stepper.index() + 1} of ${ONBOARDING_STEPS.length}`;
    stepTitle.textContent = step.title;
    stepBody.textContent = step.body;
    backButton.disabled = stepper.index() === 0;
    nextButton.textContent = stepper.isLast() ? 'Start playing' : 'Next';
  }

  function openSteps(): void {
    stepper = createStepper();
    renderStep();
    intro.hidden = true;
    steps.hidden = false;
    root.hidden = false;
  }

  /** Leave the landing entirely and hand control to the game menu. */
  function finish(): void {
    markOnboardingSeen(storage);
    root.hidden = true;
    handler();
  }

  playButton.addEventListener('click', () => {
    // A returning player has already been taught the controls; do not make
    // them sit through it again to get to the game.
    if (hasSeenOnboarding(storage)) finish();
    else openSteps();
  });

  howButton.addEventListener('click', openSteps);
  skipButton.addEventListener('click', finish);

  nextButton.addEventListener('click', () => {
    if (!stepper.next()) finish();
    else renderStep();
  });

  backButton.addEventListener('click', () => {
    if (stepper.back()) renderStep();
  });

  return {
    element: root,
    show: () => {
      intro.hidden = false;
      steps.hidden = true;
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
    },
    showHowToPlay: openSteps,
    onDone: (h) => {
      handler = h;
    },
    dispose: () => {
      root.remove();
    },
  };
}
