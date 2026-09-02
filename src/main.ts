import './style.css';
import { createScene } from './scene.ts';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('#app container not found');

const view = createScene(container);

function loop(): void {
  view.render();
  requestAnimationFrame(loop);
}
loop();
