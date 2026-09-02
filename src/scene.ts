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
import { classifyBallInPlay, landingFrom, resolvePitch } from './game/atbat.ts';
import type { PitchOutcome } from './game/atbat.ts';
import { formatScoreboard } from './game/scoreboard.ts';
import type { TeamNames } from './game/scoreboard.ts';
import { type GameState, applyPitchToGame, newGame } from './game/game.ts';
import { createSounds } from './game/audio.ts';
import { createEffects } from './effects.ts';
import { createRunners } from './runners.ts';
import { createMenu } from './menu.ts';
import { BASES } from './field.ts';

const FOV_DEGREES = 55;
const CAMERA_HOME = new Vector3(0, 2.4, -5.2);
const WIND_TIME = 1.3;
const TAKE_GRACE = 0.22;
const RESULT_TIME = 1.9;
const MAX_FLIGHT = 3.5;
const SWING_DURATION = 0.11;
const SWING_ANGLE = -1.5;

const ZONE_IDLE = 0xffd23f;
const ZONE_HIT = 0x35c759;
const ZONE_FOUL = 0xff9f0a;
const ZONE_MISS = 0xff3b30;
const ZONE_BALL = 0x4c9bff;

type Phase = 'winding' | 'pitch' | 'result';
type Screen = 'menu' | 'playing' | 'paused';

export interface BlockyardScene {
  render: () => void;
  resize: () => void;
  dispose: () => void;
}

function tintFor(outcome: PitchOutcome): number {
  switch (outcome.kind) {
    case 'ball':
      return ZONE_BALL;
    case 'foul':
      return ZONE_FOUL;
    case 'called-strike':
    case 'swinging-strike':
      return ZONE_MISS;
    case 'in-play':
      return outcome.play.hit ? ZONE_HIT : ZONE_MISS;
    default:
      return ZONE_IDLE;
  }
}

/**
 * Build the whole game: a Quick Play menu, the batter's box (fixed camera behind
 * home plate, a rolled pitch each cycle, a spacebar swing), the pure sim
 * (`atbat` → `inning` → `game`) driving a live count, outs, baserunners, and a
 * scoreboard, a full nine-inning game with a win screen, pause, and play again.
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
    new BoxGeometry(34, 1, 80),
    new MeshStandardMaterial({ color: 0x4c9a4c }),
  );
  ground.position.set(0, -0.5, 18);
  scene.add(ground);

  const plate = new Mesh(
    new BoxGeometry(0.6, 0.1, 0.6),
    new MeshStandardMaterial({ color: 0xf2f2f2 }),
  );
  plate.position.set(0, 0.05, 0);
  scene.add(plate);

  const baseMaterial = new MeshStandardMaterial({ color: 0xf2f2f2 });
  for (let i = 1; i < BASES.length; i++) {
    const marker = new Mesh(new BoxGeometry(0.45, 0.08, 0.45), baseMaterial);
    marker.position.set(BASES[i][0], BASES[i][1], BASES[i][2]);
    scene.add(marker);
  }

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

  const board = document.createElement('div');
  board.className = 'scoreboard';
  container.appendChild(board);

  const overlay = document.createElement('div');
  overlay.className = 'gameover';
  overlay.hidden = true;
  container.appendChild(overlay);

  const pausePanel = document.createElement('div');
  pausePanel.className = 'gameover';
  pausePanel.hidden = true;
  pausePanel.textContent = 'PAUSED  ·  R resume  ·  M menu';
  container.appendChild(pausePanel);

  const sounds = createSounds();
  const effects = createEffects(scene);
  const runners = createRunners(scene);
  const menu = createMenu(container);

  let screen: Screen = 'menu';
  let teams: TeamNames = { away: 'Away', home: 'Home' };

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

  let game: GameState = newGame();
  let pendingHalfReset = false;

  function setBall(p: readonly [number, number, number]): void {
    ball.position.set(p[0], p[1], p[2]);
  }

  function pitchBallAt(u: number): [number, number, number] {
    return ballPositionAt(u, plateTarget(pitch.location), pitch.lateBreak);
  }

  function shake(magnitude: number, duration: number): void {
    shakeClock = 0;
    shakeDuration = duration;
    shakeMagnitude = magnitude;
  }

  function totalRuns(state: GameState): number {
    return state.score.away + state.score.home;
  }

  function concludePitch(outcome: PitchOutcome, feel = ''): void {
    const before = game;
    game = applyPitchToGame(game, outcome);

    if (totalRuns(game) > totalRuns(before)) {
      sounds.crowd('perfect');
      shake(0.2, 0.4);
    }

    if (game.halfIndex !== before.halfIndex) pendingHalfReset = true;
    else runners.setBases(game.half.bases);

    readout = feel ? `${feel} — ${game.half.lastEvent}` : game.half.lastEvent;
    zoneTint = tintFor(outcome);

    if (game.final) {
      const who = game.winner === 'home' ? teams.home : teams.away;
      overlay.textContent = `${who.toUpperCase()} WINS  ${game.score.away}–${game.score.home}  ·  SPACE play again  ·  M menu`;
      overlay.hidden = false;
    }
  }

  function beginWinding(): void {
    if (pendingHalfReset) {
      runners.reset();
      pendingHalfReset = false;
    }
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

  function endWithResult(): void {
    phase = 'result';
    phaseClock = 0;
  }

  function startGame(): void {
    teams = menu.names();
    menu.hide();
    overlay.hidden = true;
    pausePanel.hidden = true;
    game = newGame();
    pendingHalfReset = false;
    runners.reset();
    screen = 'playing';
    beginWinding();
  }

  function toMenu(): void {
    screen = 'menu';
    overlay.hidden = true;
    pausePanel.hidden = true;
    menu.show();
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
      const feel =
        quality === 'perfect'
          ? `PERFECT · ${feet} ft`
          : quality === 'solid'
            ? `SOLID · ${feet} ft`
            : `weak · ${feet} ft`;
      sounds.crack(quality);
      sounds.crowd(quality);
      effects.burst(contactPos, quality === 'perfect' ? 1 : quality === 'solid' ? 0.6 : 0.3);
      shake(quality === 'perfect' ? 0.28 : quality === 'solid' ? 0.16 : 0.08, 0.35);
      concludePitch(
        { kind: 'in-play', play: classifyBallInPlay(landingFrom(contactPos, battedVel)) },
        feel,
      );
    } else if (judgement.result === 'foul') {
      battedVel = [error < 0 ? 4 : -4, 7, -3];
      ballFlying = true;
      flightClock = 0;
      sounds.foul();
      effects.burst(contactPos, 0.2);
      shake(0.05, 0.2);
      concludePitch({ kind: 'foul' });
    } else {
      sounds.whiff();
      concludePitch({ kind: 'swinging-strike' });
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    const k = e.code;

    if (screen === 'menu') {
      if (k === 'Enter') {
        e.preventDefault();
        startGame();
      }
      return;
    }

    if (screen === 'paused') {
      if (k === 'KeyR' || k === 'Escape') {
        e.preventDefault();
        screen = 'playing';
        pausePanel.hidden = true;
      } else if (k === 'KeyM') {
        e.preventDefault();
        toMenu();
      }
      return;
    }

    // screen === 'playing'
    if (game.final) {
      if (k === 'Space') {
        e.preventDefault();
        startGame();
      } else if (k === 'KeyM') {
        e.preventDefault();
        toMenu();
      }
      return;
    }

    if (k === 'Escape') {
      e.preventDefault();
      screen = 'paused';
      pausePanel.hidden = false;
      return;
    }
    if (k === 'Space') {
      e.preventDefault();
      if (phase === 'winding') beginPitch();
      else swing();
    }
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

    pitchClock += dt;
    if (judgement === null) {
      setBall(pitchBallAt(pitchClock / pitch.duration));
      if (pitchClock >= pitch.duration + TAKE_GRACE) {
        sounds.mitt();
        concludePitch(resolvePitch(null, pitch.inZone));
        endWithResult();
      }
      return;
    }

    if (battedVel) {
      endWithResult();
    } else {
      setBall(pitchBallAt(pitchClock / pitch.duration));
      if (pitchClock > pitch.duration + 0.35) endWithResult();
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
    if (screen === 'playing') {
      phaseClock += dt;
      if (!game.final) stepRound(dt);
      stepBall(dt);
    }
    effects.update(dt);
    runners.update(dt);

    if (swingClock >= 0) {
      swingClock += dt;
      batter.rotation.y = SWING_ANGLE * Math.min(swingClock / SWING_DURATION, 1);
    } else {
      batter.rotation.y = 0;
    }

    stepCamera(dt);
    zoneMaterial.color.setHex(zoneTint);

    hud.textContent = screen === 'playing' && !game.final ? readout : '';
    board.textContent =
      screen === 'menu'
        ? ''
        : game.final
          ? `FINAL  ·  ${teams.away.toUpperCase()} ${game.score.away}  ${teams.home.toUpperCase()} ${game.score.home}`
          : formatScoreboard(game.halfIndex, game.half, game.score, teams);
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

  menu.onPlay(startGame);
  menu.show();
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
      runners.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hud.remove();
      board.remove();
      overlay.remove();
      pausePanel.remove();
      menu.element.remove();
    },
  };
}
