/**
 * Baserunner animation. Reconciles a pool of cube "runners" to the base state
 * from `game/inning.ts`, sliding each runner forward when the state changes and
 * fading out those that cross the plate to score. Pure Three.js — it never
 * decides who advances, it just shows the result the inning model already
 * computed.
 */

import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  Vector3,
} from 'three';
import { BASES } from './field.ts';
import type { BaseState } from './game/inning.ts';

const ADVANCE_TIME = 0.55;
const FADE_TIME = 0.4;
const POOL_SIZE = 6;

interface Slot {
  mesh: Mesh;
  /** Base index this runner is standing on: 1, 2 or 3. */
  base: number;
}

interface Move {
  mesh: Mesh;
  from: Vector3;
  to: Vector3;
  clock: number;
  scoring: boolean;
  fade: number;
}

export interface Runners {
  /** Reconcile the shown runners to a new base state, animating the changes. */
  setBases: (bases: BaseState) => void;
  /** Clear every runner (start of a half-inning). */
  reset: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createRunners(scene: Scene): Runners {
  const geometry = new BoxGeometry(0.5, 1.1, 0.5);
  const pool: Mesh[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({ color: 0xf4d03f, transparent: true }),
    );
    mesh.visible = false;
    scene.add(mesh);
    pool.push(mesh);
  }

  let slots: (Slot | null)[] = [null, null, null];
  const moves: Move[] = [];

  const material = (mesh: Mesh): MeshStandardMaterial =>
    mesh.material as MeshStandardMaterial;

  function standAt(base: number): Vector3 {
    const [x, y, z] = BASES[base];
    return new Vector3(x, y + 0.55, z);
  }

  function freeMesh(): Mesh | null {
    return pool.find((mesh) => !mesh.visible) ?? null;
  }

  function startMove(mesh: Mesh, fromBase: number, toBase: number, scoring: boolean): void {
    mesh.visible = true;
    material(mesh).opacity = 1;
    const from = standAt(fromBase);
    mesh.position.copy(from);
    moves.push({
      mesh,
      from,
      to: standAt(scoring ? 0 : toBase),
      clock: 0,
      scoring,
      fade: 0,
    });
  }

  function setBases(next: BaseState): void {
    const want = [next[0], next[1], next[2]];
    const previous = slots;
    const result: (Slot | null)[] = [null, null, null];
    const reused = new Set<Slot>();

    for (let target = 2; target >= 0; target--) {
      if (!want[target]) continue;

      let picked: Slot | null = null;
      for (let s = target; s >= 0; s--) {
        const cand = previous[s];
        if (cand && !reused.has(cand)) {
          picked = cand;
          break;
        }
      }

      if (picked) {
        reused.add(picked);
        if (picked.base !== target + 1) {
          startMove(picked.mesh, picked.base, target + 1, false);
          picked.base = target + 1;
        }
        result[target] = picked;
      } else {
        const mesh = freeMesh();
        if (mesh) {
          startMove(mesh, 0, target + 1, false);
          result[target] = { mesh, base: target + 1 };
        }
      }
    }

    for (const cand of previous) {
      if (cand && !reused.has(cand)) startMove(cand.mesh, cand.base, 0, true);
    }

    slots = result;
  }

  function reset(): void {
    for (const mesh of pool) mesh.visible = false;
    slots = [null, null, null];
    moves.length = 0;
  }

  function update(dt: number): void {
    for (let i = moves.length - 1; i >= 0; i--) {
      const move = moves[i];

      if (move.fade === 0) {
        move.clock += dt;
        const t = Math.min(move.clock / ADVANCE_TIME, 1);
        move.mesh.position.lerpVectors(move.from, move.to, t);
        move.mesh.position.y = move.to.y + Math.sin(t * Math.PI) * 0.25;
        if (t >= 1) {
          if (move.scoring) move.fade = Number.EPSILON;
          else moves.splice(i, 1);
        }
      } else {
        move.fade += dt;
        material(move.mesh).opacity = Math.max(1 - move.fade / FADE_TIME, 0);
        if (move.fade >= FADE_TIME) {
          move.mesh.visible = false;
          moves.splice(i, 1);
        }
      }
    }
  }

  function dispose(): void {
    for (const mesh of pool) {
      scene.remove(mesh);
      material(mesh).dispose();
    }
    geometry.dispose();
  }

  return { setBases, reset, update, dispose };
}
