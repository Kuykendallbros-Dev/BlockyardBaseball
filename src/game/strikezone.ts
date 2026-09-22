/**
 * Pure zone-targeting logic for the batter's pre-swing guess. The strike zone
 * (see `ZONE_HALF_WIDTH`/`ZONE_HALF_HEIGHT` in `./pitching.ts`) is carved into a
 * 4x4 grid of 16 tiles. Before a pitch the batter picks a tile they think
 * they'll need to cover; once the pitch is released they get exactly one tile
 * of adjustment. If their final tile isn't close enough to where the pitch
 * actually crosses, the swing is gated to an automatic whiff before the
 * existing timing-based contact model (`./swing.ts`) ever runs — see
 * `judgeSwingWithZoneGuess` in `./atbat.ts`, which composes this with
 * `judgeSwing`.
 *
 * Coordinate space matches `./pitching.ts`: `[x, y]` in metres, relative to the
 * strike-zone centre. +x is the batter's pull side, +y is up.
 */

import { ZONE_HALF_HEIGHT, ZONE_HALF_WIDTH } from './pitching.ts';

/** 4x4 grid: 16 tiles, 4 per quadrant. */
export const GRID_SIZE = 4;

/**
 * How close (in tiles) the batter's final guess must be to the pitch's actual
 * tile for the swing to proceed to normal timing-based contact resolution.
 * Chebyshev (king-move) distance: same tile up to 2 tiles away in any
 * direction, including diagonally, still counts.
 */
export const TOLERANCE_TILES = 2;

/**
 * A tile address on the grid. `row` increases from bottom (0, low y) to top
 * (`GRID_SIZE - 1`, high y). `col` increases from the batter's push side (0,
 * low x) to the pull side (`GRID_SIZE - 1`, high x).
 */
export interface TileCoord {
  row: number;
  col: number;
}

function clampIndex(i: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, i));
}

/**
 * Classify a physical point (e.g. a pitch's `crossing`) into a tile. Points
 * outside the zone's bounds clamp to the nearest edge/corner tile, so a pitch
 * thrown well off the plate still resolves to *some* tile for the distance
 * check rather than being unclassifiable.
 */
export function tileForPoint(point: readonly [number, number]): TileCoord {
  const nx = (point[0] + ZONE_HALF_WIDTH) / (2 * ZONE_HALF_WIDTH);
  const ny = (point[1] + ZONE_HALF_HEIGHT) / (2 * ZONE_HALF_HEIGHT);
  const col = clampIndex(Math.floor(nx * GRID_SIZE));
  const row = clampIndex(Math.floor(ny * GRID_SIZE));
  return { row, col };
}

/** Flatten a tile to a single 0..15 index (row-major), handy as a React-free key. */
export function tileIndex(tile: TileCoord): number {
  return tile.row * GRID_SIZE + tile.col;
}

/** Chebyshev (king-move) distance between two tiles. */
export function tileDistance(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

/** Is `chosen` within `tolerance` tiles (Chebyshev) of `actual`? */
export function isWithinTolerance(
  chosen: TileCoord,
  actual: TileCoord,
  tolerance: number = TOLERANCE_TILES,
): boolean {
  return tileDistance(chosen, actual) <= tolerance;
}

/**
 * Does the batter's chosen tile cover where the pitch actually crossed? A
 * thin convenience over `tileForPoint` + `isWithinTolerance` for callers that
 * only have the physical crossing point.
 */
export function isZoneGuessCorrect(
  chosen: TileCoord,
  crossing: readonly [number, number],
  tolerance: number = TOLERANCE_TILES,
): boolean {
  return isWithinTolerance(chosen, tileForPoint(crossing), tolerance);
}

/**
 * Apply one requested tile pick during pitch flight, enforcing the
 * one-adjustment rule: the first pick after the pitch is released moves the
 * guess and consumes the adjustment; every pick after that is ignored and the
 * guess holds. Picking before the pitch is released isn't gated at all — the
 * caller should just track the free pre-pitch selection directly and only
 * start calling `pickTile` once the pitch is in flight.
 */
export function pickTile(
  current: TileCoord,
  requested: TileCoord,
  alreadyAdjusted: boolean,
): { tile: TileCoord; adjusted: boolean } {
  if (alreadyAdjusted) return { tile: current, adjusted: true };
  return { tile: requested, adjusted: true };
}
