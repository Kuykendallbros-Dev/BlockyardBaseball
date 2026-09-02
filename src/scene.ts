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
  Vector3,
  WebGLRenderer,
} from 'three';
import { aspectRatio } from './math.ts';
import { PLATE_POINT, RELEASE_POINT, ballPositionAt } from './game/pitch.ts';
import { judgeSwing, launchVelocity } from './game/swing.ts';
import type { SwingJudgement } from './game/swing.ts';
import { METRES_TO_FEET, carryDistance, projectilePosition } from './game/flight.ts';
import { type Pitch, plateTarget, rollPitch } from './game/pitching.ts';
import { createSounds } from './game/audio.ts';
import { createEffects } from './effects.ts';

const FOV_DEGREES = 55;
const CAMERA_HOME = new Vector3(0, 2.4, -5.2);
/** Seconds the pitcher holds the ball before each pitch. */
const WIND_TIME = 1.3;
/** Extra seconds after the ball crosses the plate before a no-swing is a take. */
const TAKE_GRACE = 0.22;
/** Seconds the outcome readout stays up before the next pitch. */
const RESULT_TIME = 1.8;
/** Hard cap on how long a batted ball stays animated. */
const MAX_FLIGHT = 3.5;
const SWING_DURATION = 0.11;
const SWING_ANGLE = -1.5;

const ZONE_IDLE = 0xffd23f;
const ZONE_HIT = 0x35c759;
const ZONE_FOUL = 0xff9f0a;
const ZONE_MISS = 0xff3b30;
const ZONE_BALL = 0x4c9bff;

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
 * cube that throws a rolled pitch (type / speed / location / late break) across
 * the plate on a timer, and a spacebar swing whose timing resolves into whiff /
 * foul / contact (perfect / solid / weak) with a readout, a sound, a spark
 * burst, screen shake, a ball trail, and a carry-distance callout on a hit.
 */
export function createScene(container: HTMLElement): BlockyardScene {
  const scene = new Scene();
  scene.background = new Color(0x8ec5ff);

  const camera = new PerspectiveCamera(FOV_DEGREES, 1, 0.1, 500);
  camera.position.copy(CAMERA_HOME);
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

  const zoneMaterial = new LineBasicMaterial({ color: ZONE_IDLE });
  const zone = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.9, 1.1, 0.05)),
    zoneMaterial,
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
  const effects = createEffects(scene);

  let phase: Phase = 'winding';
  let phaseClock = 0;
  let pitchClock = 0;
  let pitch: Pitch = rollPitch();
  let judgement: SwingJudgement | null = null;
  let contactPos: [number, number, number] = [0, 0, 0];
  let battedVel: [number, number, number] | null = null;
  let flightClock = 0;
  let ballFlying = false;
  let swingClock = -1;
  let readout = 'SPACE to swing';
  let zoneTint = ZONE_IDLE;
  let shakeClock = 1;
  let shakeDuration = 0.3;
  let shakeMagnitude = 0;

  function setBall(p: readonly [number, number, number]): void {
    ball.position.set(p[0], p[1], p[2]);
  }

  /** Ball position along the current pitch at flight fraction `u`. */
  function pitchBallAt(u: number): [number, number, number] {
    return ballPositionAt(u, plateTarget(pitch.location), pitch.lateBreak);
  }

  function shake(magnitude: number, duration: number): void {
    shakeClock = 0;
    shakeDuration = duration;
    shakeMagnitude = magnitude;
  }

  function beginWinding(): void {
    phase = 'winding';
    phaseClock = 0;
    pitchClock = 0;
    judgement = null;
    battedVel = null;
    ballFlying = false;
    flightClock = 0;
    swingClock = -1;
    readout = 'SPACE to swing';
    zoneTint = ZONE_IDLE;
    effects.clearTrail();
    setBall(RELEASE_POINT);
  }

  function beginPitch(): void {
    phase = 'pitch';
    phaseClock = 0;
    pitchClock = 0;
    pitch = rollPitch();
    readout = pitch.type;
  }

  function endWithResult(tint: number): void {
    phase = 'result';
    phaseClock = 0;
    zoneTint = tint;
  }

  function swing(): void {
    if (phase !== 'pitch' || judgement !== null) return;
    const error = pitchClock - pitch.duration;
    swingClock = 0;
    judgement = judgeSwing(error);
    contactPos = pitchBallAt(pitchClock / pitch.duration);

    if (judgement.result === 'contact' && judgement.quality) {
      const quality = judgement.quality;
      battedVel = launchVelocity(error, quality);
      ballFlying = true;
      flightClock = 0;
      const feet = Math.round(carryDistance(contactPos, battedVel) * METRES_TO_FEET);
      const label =
        quality === 'perfect'
          ? 'PERFECT — CRACK!'
          : quality === 'solid'
            ? 'SOLID'
            : 'weak contact';
      readout = `${label} · ${feet} ft`;
      sounds.crack(quality);
      sounds.crowd(quality);
      const power = quality === 'perfect' ? 1 : quality === 'solid' ? 0.6 : 0.3;
      effects.burst(contactPos, power);
      shake(quality === 'perfect' ? 0.28 : quality === 'solid' ? 0.16 : 0.08, 0.35);
    } else if (judgement.result === 'foul') {
      battedVel = [error < 0 ? 4 : -4, 7, -3]; // pops up back toward the screen
      ballFlying = true;
      flightClock = 0;
      sounds.foul();
      effects.burst(contactPos, 0.2);
      shake(0.05, 0.2);
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

  function stepRound(dt: number): void {
    if (phase === 'winding') {
      setBall(RELEASE_POINT);
      if (phaseClock >= WIND_TIME) beginPitch();
      return;
    }

    if (phase === 'result') {
      if (phaseClock >= RESULT_TIME && !ballFlying) beginWinding();
      return;
    }

    // phase === 'pitch'
    pitchClock += dt;
    if (judgement === null) {
      setBall(pitchBallAt(pitchClock / pitch.duration));
      if (pitchClock >= pitch.duration + TAKE_GRACE) {
        readout = pitch.inZone ? 'took it — strike' : 'took it — ball';
        sounds.mitt();
        endWithResult(pitch.inZone ? ZONE_MISS : ZONE_BALL);
      }
      return;
    }

    if (battedVel) {
      endWithResult(judgement.result === 'contact' ? ZONE_HIT : ZONE_FOUL);
    } else {
      // whiffed — let the pitch finish crossing the plate
      setBall(pitchBallAt(pitchClock / pitch.duration));
      if (pitchClock > pitch.duration + 0.35) endWithResult(ZONE_MISS);
    }
  }

  function stepBall(dt: number): void {
    if (!ballFlying || !battedVel) {
      if (phase !== 'pitch') effects.clearTrail();
      return;
    }
    flightClock += dt;
    setBall(projectilePosition(contactPos, battedVel, flightClock));
    effects.trackBall([ball.position.x, ball.position.y, ball.position.z]);
    if (ball.position.y <= 0.12 || flightClock > MAX_FLIGHT) ballFlying = false;
  }

  function stepCamera(dt: number): void {
    camera.position.copy(CAMERA_HOME);
    if (shakeClock < shakeDuration) {
      shakeClock += dt;
      const k = (1 - shakeClock / shakeDuration) * shakeMagnitude;
      camera.position.x += (Math.random() * 2 - 1) * k;
      camera.position.y += (Math.random() * 2 - 1) * k;
    }
  }

  function step(dt: number): void {
    phaseClock += dt;
    stepRound(dt);
    stepBall(dt);
    effects.update(dt);

    if (swingClock >= 0) {
      swingClock += dt;
      batter.rotation.y = SWING_ANGLE * Math.min(swingClock / SWING_DURATION, 1);
    } else {
      batter.rotation.y = 0;
    }

    stepCamera(dt);
    zoneMaterial.color.setHex(zoneTint);
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
      effects.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hud.remove();
    },
  };
}
