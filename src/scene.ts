import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { aspectRatio, orbitRadius } from './math.ts';

const GROUND_SIZE = 40;
const BATTER_HEIGHT = 2;
const FOV_DEGREES = 50;

export interface BlockyardScene {
  /** Advance and draw one frame. */
  render: () => void;
  /** Recompute camera + renderer for the current container size. */
  resize: () => void;
  /** Release GPU resources and listeners. */
  dispose: () => void;
}

/**
 * Build the Phase 0 scene: a blocky ground plane and a cube "batter" viewed
 * through an orbit camera. Everything lives inside `container`.
 */
export function createScene(container: HTMLElement): BlockyardScene {
  const scene = new Scene();
  scene.background = new Color(0x8ec5ff);

  const camera = new PerspectiveCamera(FOV_DEGREES, 1, 0.1, 500);
  const radius = orbitRadius(FOV_DEGREES, BATTER_HEIGHT) + 6;
  camera.position.set(radius, radius * 0.6, radius);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, BATTER_HEIGHT / 2, 0);
  controls.minDistance = 4;
  controls.maxDistance = 80;

  scene.add(new HemisphereLight(0xffffff, 0x557755, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(12, 20, 8);
  scene.add(sun);

  const ground = new Mesh(
    new BoxGeometry(GROUND_SIZE, 1, GROUND_SIZE),
    new MeshStandardMaterial({ color: 0x4c9a4c }),
  );
  ground.position.y = -0.5;
  scene.add(ground);

  const batter = new Mesh(
    new BoxGeometry(1, BATTER_HEIGHT, 1),
    new MeshStandardMaterial({ color: 0xd8442f }),
  );
  batter.position.y = BATTER_HEIGHT / 2;
  scene.add(batter);

  function resize(): void {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = aspectRatio(w, h);
    camera.updateProjectionMatrix();
  }

  function render(): void {
    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    render,
    resize,
    dispose: () => {
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
