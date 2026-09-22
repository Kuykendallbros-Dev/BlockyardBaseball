import './style.css';
import { createScene } from './scene.ts';
import { createLanding } from './landing.ts';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('#app container not found');

const view = createScene(container);

// P6-1: the landing page sits over the scene on every visit — it is the page
// an unknown visitor arrives on. The scene and its menu build underneath, so
// the game is already warm by the time the player presses Play. First-timers
// get the how-to-play walkthrough; returning players go straight through.
const landing = createLanding(container);
landing.onDone(() => {
  landing.hide();
});

function loop(): void {
  view.render();
  requestAnimationFrame(loop);
}
loop();
