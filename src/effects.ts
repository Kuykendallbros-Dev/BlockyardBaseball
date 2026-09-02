/**
 * Throwaway visual juice for the batter's box: a spark burst on contact and a
 * fading trail behind the batted ball. Both are fixed-size mesh pools that live
 * in a `Group` under the scene, so there is no per-hit allocation. Pure Three.js
 * — the game logic never imports this.
 */

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  SphereGeometry,
} from 'three';

const SPARK_COUNT = 16;
const SPARK_DURATION = 0.5;
const SPARK_GRAVITY = 20;
const TRAIL_COUNT = 16;

interface Spark {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
}

export interface Effects {
  /** Fire a spark burst at a world point; `power` in 0..1 scales the spread. */
  burst: (at: readonly [number, number, number], power: number) => void;
  /** Feed the current ball position so the trail follows it. */
  trackBall: (at: readonly [number, number, number]) => void;
  /** Hide the trail — call whenever the ball is not in batted flight. */
  clearTrail: () => void;
  /** Advance every active effect by `dt` seconds. */
  update: (dt: number) => void;
  dispose: () => void;
}

export function createEffects(scene: Scene): Effects {
  const group = new Group();
  scene.add(group);

  const sparkGeometry = new BoxGeometry(0.09, 0.09, 0.09);
  const sparks: Spark[] = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const mesh = new Mesh(
      sparkGeometry,
      new MeshBasicMaterial({ color: 0xfff1a6, transparent: true }),
    );
    mesh.visible = false;
    group.add(mesh);
    sparks.push({ mesh, vx: 0, vy: 0, vz: 0 });
  }
  let sparkClock = SPARK_DURATION;

  const trailGeometry = new SphereGeometry(0.1, 8, 6);
  const trail: Mesh[] = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const mesh = new Mesh(
      trailGeometry,
      new MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );
    mesh.visible = false;
    group.add(mesh);
    trail.push(mesh);
  }
  const history: [number, number, number][] = [];

  function material(mesh: Mesh): MeshBasicMaterial {
    return mesh.material as MeshBasicMaterial;
  }

  return {
    burst: (at, power) => {
      sparkClock = 0;
      const spread = 3 + power * 8;
      for (const s of sparks) {
        s.mesh.position.set(at[0], at[1], at[2]);
        s.mesh.visible = true;
        s.mesh.scale.setScalar(1);
        s.vx = (Math.random() * 2 - 1) * spread;
        s.vy = Math.random() * spread * 0.8 + 1;
        s.vz = (Math.random() * 2 - 1) * spread;
      }
    },

    trackBall: (at) => {
      history.unshift([at[0], at[1], at[2]]);
      if (history.length > TRAIL_COUNT) history.pop();
    },

    clearTrail: () => {
      history.length = 0;
      for (const m of trail) m.visible = false;
    },

    update: (dt) => {
      if (sparkClock < SPARK_DURATION) {
        sparkClock += dt;
        const life = Math.max(1 - sparkClock / SPARK_DURATION, 0);
        for (const s of sparks) {
          s.vy -= SPARK_GRAVITY * dt;
          s.mesh.position.x += s.vx * dt;
          s.mesh.position.y += s.vy * dt;
          s.mesh.position.z += s.vz * dt;
          s.mesh.scale.setScalar(Math.max(life, 0.01));
          material(s.mesh).opacity = life;
          if (life <= 0) s.mesh.visible = false;
        }
      }

      for (let i = 0; i < trail.length; i++) {
        const p = history[i];
        const m = trail[i];
        if (!p) {
          m.visible = false;
          continue;
        }
        m.visible = true;
        m.position.set(p[0], p[1], p[2]);
        const k = 1 - i / trail.length;
        m.scale.setScalar(k * 1.1);
        material(m).opacity = k * 0.6;
      }
    },

    dispose: () => {
      scene.remove(group);
      sparkGeometry.dispose();
      trailGeometry.dispose();
      for (const s of sparks) material(s.mesh).dispose();
      for (const m of trail) material(m).dispose();
    },
  };
}
