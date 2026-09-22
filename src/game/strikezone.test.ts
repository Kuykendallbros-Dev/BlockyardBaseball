import { describe, expect, it } from 'vitest';
import { ZONE_HALF_HEIGHT, ZONE_HALF_WIDTH } from './pitching.ts';
import {
  GRID_SIZE,
  TOLERANCE_TILES,
  isWithinTolerance,
  isZoneGuessCorrect,
  pickTile,
  tileDistance,
  tileForPoint,
  tileIndex,
} from './strikezone.ts';

describe('tileForPoint', () => {
  it('puts dead centre at the middle of the grid', () => {
    // Dead centre [0, 0] is exactly on the row/col 1|2 boundary; either side
    // of that seam is a reasonable "middle" tile.
    const { row, col } = tileForPoint([0, 0]);
    expect(row).toBeGreaterThanOrEqual(1);
    expect(row).toBeLessThanOrEqual(2);
    expect(col).toBeGreaterThanOrEqual(1);
    expect(col).toBeLessThanOrEqual(2);
  });

  it('puts the low-outside corner at row 0, col 0', () => {
    expect(tileForPoint([-ZONE_HALF_WIDTH, -ZONE_HALF_HEIGHT])).toEqual({
      row: 0,
      col: 0,
    });
  });

  it('puts the high-pull-side corner at the last row and column', () => {
    // Exactly on the far edge is a boundary case: it must still land inside
    // the grid (the last tile), not spill into a nonexistent 5th tile.
    expect(tileForPoint([ZONE_HALF_WIDTH, ZONE_HALF_HEIGHT])).toEqual({
      row: GRID_SIZE - 1,
      col: GRID_SIZE - 1,
    });
  });

  it('assigns every tile a distinct row/col within [0, GRID_SIZE)', () => {
    const seen = new Set<number>();
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // sample a point inside that tile's cell
        const x = -ZONE_HALF_WIDTH + ((2 * ZONE_HALF_WIDTH) / GRID_SIZE) * (col + 0.5);
        const y = -ZONE_HALF_HEIGHT + ((2 * ZONE_HALF_HEIGHT) / GRID_SIZE) * (row + 0.5);
        const tile = tileForPoint([x, y]);
        expect(tile.row).toBe(row);
        expect(tile.col).toBe(col);
        seen.add(tileIndex(tile));
      }
    }
    expect(seen.size).toBe(GRID_SIZE * GRID_SIZE);
  });

  it('clamps a pitch well outside the zone to the nearest edge tile', () => {
    expect(tileForPoint([-ZONE_HALF_WIDTH * 5, 0])).toEqual(
      tileForPoint([-ZONE_HALF_WIDTH, 0]),
    );
    expect(tileForPoint([0, ZONE_HALF_HEIGHT * 5])).toEqual(
      tileForPoint([0, ZONE_HALF_HEIGHT]),
    );
  });

  it('clamps a pitch far off in both dimensions to the far corner tile', () => {
    expect(tileForPoint([ZONE_HALF_WIDTH * 9, ZONE_HALF_HEIGHT * 9])).toEqual({
      row: GRID_SIZE - 1,
      col: GRID_SIZE - 1,
    });
  });
});

describe('tileDistance / isWithinTolerance', () => {
  it('is zero for the same tile', () => {
    expect(tileDistance({ row: 2, col: 2 }, { row: 2, col: 2 })).toBe(0);
  });

  it('counts diagonal steps the same as straight steps (Chebyshev)', () => {
    expect(tileDistance({ row: 0, col: 0 }, { row: 2, col: 2 })).toBe(2);
    expect(tileDistance({ row: 0, col: 0 }, { row: 0, col: 2 })).toBe(2);
    expect(tileDistance({ row: 0, col: 0 }, { row: 2, col: 0 })).toBe(2);
  });

  it('accepts exactly at the tolerance boundary and rejects one past it', () => {
    const chosen = { row: 0, col: 0 };
    expect(isWithinTolerance(chosen, { row: 2, col: 2 })).toBe(true);
    expect(isWithinTolerance(chosen, { row: 3, col: 0 })).toBe(false);
    expect(isWithinTolerance(chosen, { row: 0, col: 3 })).toBe(false);
  });

  it('respects a custom tolerance', () => {
    const chosen = { row: 0, col: 0 };
    const actual = { row: 1, col: 1 };
    expect(isWithinTolerance(chosen, actual, 0)).toBe(false);
    expect(isWithinTolerance(chosen, actual, 1)).toBe(true);
  });

  it('defaults to TOLERANCE_TILES', () => {
    expect(TOLERANCE_TILES).toBe(2);
  });
});

describe('isZoneGuessCorrect', () => {
  it('is correct when the guess covers dead centre', () => {
    expect(isZoneGuessCorrect({ row: 2, col: 2 }, [0, 0])).toBe(true);
  });

  it('is incorrect when the guess is the opposite corner from where it crossed', () => {
    expect(
      isZoneGuessCorrect({ row: 0, col: 0 }, [ZONE_HALF_WIDTH, ZONE_HALF_HEIGHT]),
    ).toBe(false);
  });

  it('is correct for a pitch just barely off the plate near the chosen tile', () => {
    // low-outside corner tile chosen; pitch crosses just outside the zone in
    // the same corner — still within 2 tiles once clamped.
    expect(
      isZoneGuessCorrect(
        { row: 0, col: 0 },
        [-ZONE_HALF_WIDTH - 0.2, -ZONE_HALF_HEIGHT - 0.2],
      ),
    ).toBe(true);
  });
});

describe('pickTile', () => {
  const current = { row: 1, col: 1 };
  const requested = { row: 1, col: 2 };

  it('moves to the requested tile on the first (unadjusted) pick', () => {
    const result = pickTile(current, requested, false);
    expect(result).toEqual({ tile: requested, adjusted: true });
  });

  it('ignores a second pick once already adjusted', () => {
    const first = pickTile(current, requested, false);
    const second = pickTile(first.tile, { row: 3, col: 3 }, first.adjusted);
    expect(second).toEqual({ tile: requested, adjusted: true });
  });

  it('holds the current tile forever once adjusted, regardless of what is requested', () => {
    const held = pickTile({ row: 0, col: 0 }, { row: 3, col: 3 }, true);
    expect(held.tile).toEqual({ row: 0, col: 0 });
    expect(held.adjusted).toBe(true);
  });
});
