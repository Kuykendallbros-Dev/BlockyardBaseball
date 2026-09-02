import {
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { aspectRatio } from './math.ts';
import {
  PITCH_DURATION,
  PLATE_POINT,
  RELEASE_POINT,
  ballPositionAt,
} from './game/pitch.ts';
import { judgeSwing, launchVelocity } from './game/swing.ts';
import type { SwingJudgement } from './game/swing.ts';
import { projectilePosition } from './game/flight.ts';
import { createSounds } from './game/audio.ts';

const FOV_DEGREES = 55;
/** Seconds the pitcher holds the ball before each pitch. */
const WIND_TIME = 1.3;
/** No swing by this many seconds after release = the batter took the pitch. */
const TAKE_CUTOFF = PITCH_DURATION + 0.22;
/** Seconds the outcome readout stays up before the next pitch. */
const RESULT_TIME = 2;
const SWING_DURATION = 0.11;
const SWING_ANGLE = -1.5;

const ZONE_IDLE = 0xffd23f;
const ZONE_HIT = 0x35c759;
const ZONE_FOUL = 0xff9f0a;
const ZONE_MISS = 0xff3b30;

type Phase = 'winding' | 'pitch' | 'result';

export interface BlockyardScene {
  /** Advance and draw one frame. */
  render: () => void;
  /** Recompute camera + renderer for the current container size. */
  resize: () => void;
  /** Release GPU resources and listeners. */
  dispose: () => void;
}

/**
 * Build the Phase 0 batter's box: a fixed camera behind home plate, a pitcher
 * cube that lobs the ball across the plate on a timer, and a spacebar swing
 * whose timing resolves into whiff / foul / contact with a readout and a sound.
 */
export function createScene(container: HTMLElement): BlockyardScene {
  const scene = new Scene();
  scene.background = new Color(0x8ec5ff);

  const camera = new PerspectiveCamera(FOV_DEGREES, 1, 0.1, 500);
  camera.position.set(0, 2.4, -5.2);
  camera.lookAt(0, 1.4, 8);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new HemisphereLight(0xffffff, 0x557755, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(12, 20, 4);
  scene.add(sun);

  const ground = new Mesh(
    new BoxGeometry(30, 1, 70),
    new MeshStandardMaterial({ color: 0x4c9a4c }),
  );
  ground.position.set(0, -0.5, 16);
  scene.add(ground);

  const plate = new Mesh(
    new BoxGeometry(0.6, 0.1, 0.6),
    new MeshStandardMaterial({ color: 0xf2f2f2 }),
  );
  plate.position.set(0, 0.05, 0);
  scene.add(plate);

  const batter = new Mesh(
    new BoxGeometry(1, 2, 1),
    new MeshStandardMaterial({ color: 0xd8442f }),
  );
  batter.position.set(0.95, 1, 0.15);
  scene.add(batter);

  const pitcher = new Mesh(
    new BoxGeometry(1.3, 2.6, 1.3),
    new MeshStandardMaterial({ color: 0x3a5a8c }),
  );
  pitcher.position.set(0, 1.3, RELEASE_POINT[2] + 0.9);
  scene.add(pitcher);

  const zoneMat = new LineBasicMaterial({ color: ZONE_IDLE });
  const zone = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.9, 1.1, 0.05)),
    zoneMat,
  );
  zone.position.set(PLATE_POINT[0], PLATE_POINT[1], PLATE_POINT[2]);
  scene.add(zone);

  const ball = new Mesh(
    new SphereGeometry(0.12, 16, 12),
    new MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }),
  );
  scene.add(ball);

  const hud = document.createElement('div');
  hud.className = 'hud';
  container.appendChild(hud);

  const sounds = createSounds();

  let phase: Phase = 'winding';
  let phaseClock = 0;
  let pitchClock = 0;
  let judgement: SwingJudgement | null = null;
  let contactClock = 0;
  let contactPos: [number, number, number] = [0, 0, 0];
  let battedVel: [number, number, number] | null = null;
  let swingClock = -1;
  let readout = 'SPACE to swing';
  let zoneTint = ZONE_IDLE;

  function setBall(p: readonly [number, number, number]): void {
    ball.position.set(p[0], p[1], p[2]);
  }

  function beginWinding(): void {
    phase = 'winding';
    phaseClock = 0;
    pitchClock = 0;
    judgement = null;
    battedVel = null;
    swingClock = -1;
    readout = 'SPACE to swing';
    zoneTint = ZONE_IDLE;
    setBall(RELEASE_POINT);
  }

  function beginPitch(): void {
    phase = 'pitch';
    phaseClock = 0;
    pitchClock = 0;
    readout = 'here it comes';
  }

  function endWithResult(tint: number): void {
    phase = 'result';
    phaseClock = 0;
    zoneTint = tint;
  }

  function swing(): void {
    if (phase !== 'pitch' || judgement !== null) return;
    const error = pitchClock - PITCH_DURATION;
    swingClock = 0;
    judgement = judgeSwing(error);
    contactClock = pitchClock;
    contactPos = ballPositionAt(pitchClock / PITCH_DURATION);

    if (judgement.result === 'contact' && judgement.quality) {
      battedVel = launchVelocity(error, judgement.quality);
      sounds.crack(judgement.quality);
      readout =
        judgement.quality === 'perfect'
          ? 'PERFECT — CRACK!'
          : judgement.quality === 'solid'
            ? 'SOLID CONTACT'
            : 'weak contact';
    } else if (judgement.result === 'foul') {
      battedVel = [error < 0 ? 4 : -4, 7, 3];
      sounds.foul();
      readout = 'foul tip';
    } else {
      sounds.whiff();
      readout = 'WHIFF';
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (phase === 'winding') beginPitch();
    else swing();
  }

  function step(dt: number): void {
    phaseClock += dt;

    if (phase === 'winding') {
      setBall(RELEASE_POINT);
      if (phaseClock >= WIND_TIME) beginPitch();
    } else if (phase === 'pitch') {
      pitchClock += dt;
      if (battedVel) {
        const flight = pitchClock - contactClock;
        setBall(projectilePosition(contactPos, battedVel, flight));
        if (ball.position.y <= 0.12 || flight > 2.2) {
          endWithResult(
            judgement?.result === 'contact' ? ZONE_HIT : ZONE_FOUL,
          );
        }
      } else if (judgement) {
        setBall(ballPositionAt(pitchClock / PITCH_DURATION));
        if (pitchClock > PITCH_DURATION + 0.35) endWithResult(ZONE_MISS);
      } else {
        setBall(ballPositionAt(pitchClock / PITCH_DURATION));
        if (pitchClock >= TAKE_CUTOFF) {
          readout = 'took it';
          endWithResult(ZONE_MISS);
        }
      }
    } else if (phaseClock >= RESULT_TIME) {
      beginWinding();
    }

    if (swingClock >= 0) {
      swingClock += dt;
      batter.rotation.y = SWING_ANGLE * Math.min(swingClock / SWING_DURATION, 1);
    } else {
      batter.rotation.y = 0;
    }

    zoneMat.color.setHex(zoneTint);
    hud.textContent = readout;
  }

  let last = performance.now();
  function render(): void {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    renderer.render(scene, camera);
  }

  function resize(): void {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = aspectRatio(w, h);
    camera.updateProjectionMatrix();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', resize);
  beginWinding();
  resize();

  return {
    render,
    resize,
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
      hud.remove();
    },
  };
}
