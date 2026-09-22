/**
 * Visual + hit-testing for the human batter's 4x4 strike-zone target grid.
 * Renders 16 flat, mostly-transparent tiles over the strike-zone plane and
 * turns a pointer event into a tile pick via raycasting against the scene's
 * fixed camera. Pure Three.js — the zone-guess game logic (`game/strikezone.ts`)
 * never imports this and knows nothing about rendering or input.
 */

import {
  type Camera,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  type Scene,
  Vector2,
} from 'three';
import { PLATE_POINT } from './game/pitch.ts';
import { ZONE_HALF_HEIGHT, ZONE_HALF_WIDTH } from './game/pitching.ts';
import { GRID_SIZE, type TileCoord } from './game/strikezone.ts';

const TILE_GAP = 0.92; // shrink each tile slightly so grid lines show through
const IDLE_COLOR = 0xffffff;
const IDLE_OPACITY = 0.07;
const SELECTED_COLOR = 0xffd23f;
const SELECTED_OPACITY = 0.55;
/** Sits just in front of the zone wireframe so the two don't z-fight. */
const GRID_Z_OFFSET = 0.02;

interface Tile {
  mesh: Mesh;
  material: MeshBasicMaterial;
  coord: TileCoord;
}

export interface ZoneGrid {
  /** Highlight `tile` as the batter's current guess (or clear with `null`). */
  setSelected: (tile: TileCoord | null) => void;
  /** Show or hide the whole grid — hidden while the AI is batting. */
  setVisible: (visible: boolean) => void;
  /**
   * Raycast from the camera through normalized device coordinates
   * (`x, y` in [-1, 1]) and return the tile hit, or `null` if the ray misses
   * the grid entirely.
   */
  pickAt: (ndcX: number, ndcY: number, camera: Camera) => TileCoord | null;
  dispose: () => void;
}

export function createZoneGrid(scene: Scene): ZoneGrid {
  const tileWidth = (ZONE_HALF_WIDTH * 2) / GRID_SIZE;
  const tileHeight = (ZONE_HALF_HEIGHT * 2) / GRID_SIZE;
  const geometry = new PlaneGeometry(tileWidth * TILE_GAP, tileHeight * TILE_GAP);

  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const material = new MeshBasicMaterial({
        color: IDLE_COLOR,
        transparent: true,
        opacity: IDLE_OPACITY,
        depthWrite: false,
        // The fixed batting camera sits behind the plate looking toward +z,
        // i.e. it sees each tile's back face by default — PlaneGeometry's
        // front face normal is +z, pointing away from the camera. DoubleSide
        // keeps the tile visible (and raycastable) without needing to flip
        // every plane's winding.
        side: DoubleSide,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(
        PLATE_POINT[0] - ZONE_HALF_WIDTH + tileWidth * (col + 0.5),
        PLATE_POINT[1] - ZONE_HALF_HEIGHT + tileHeight * (row + 0.5),
        PLATE_POINT[2] + GRID_Z_OFFSET,
      );
      scene.add(mesh);
      tiles.push({ mesh, material, coord: { row, col } });
    }
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const meshes = tiles.map((t) => t.mesh);

  function setSelected(tile: TileCoord | null): void {
    for (const t of tiles) {
      const isSelected = !!tile && t.coord.row === tile.row && t.coord.col === tile.col;
      t.material.color.setHex(isSelected ? SELECTED_COLOR : IDLE_COLOR);
      t.material.opacity = isSelected ? SELECTED_OPACITY : IDLE_OPACITY;
    }
  }

  function setVisible(visible: boolean): void {
    for (const t of tiles) t.mesh.visible = visible;
  }

  function pickAt(ndcX: number, ndcY: number, camera: Camera): TileCoord | null {
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const hit = tiles.find((t) => t.mesh === hits[0].object);
    return hit ? hit.coord : null;
  }

  function dispose(): void {
    for (const t of tiles) {
      scene.remove(t.mesh);
      t.material.dispose();
    }
    geometry.dispose();
  }

  return { setSelected, setVisible, pickAt, dispose };
}
