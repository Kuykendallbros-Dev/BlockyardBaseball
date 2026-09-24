/**
 * Team rosters — the "nine players plus a bench" half of real baseball. A team
 * carries a batting order of nine (the designated hitter bats for the pitcher),
 * a bench of reserves, a starting rotation, and a bullpen: {@link ROSTER_SIZE}
 * players in total, the shape a modern mobile baseball game uses.
 *
 * Pure and deterministic: `makeTeam` takes a `rand` in [0, 1), so the same seed
 * always builds the same club. No rendering, no persistence.
 */

import { type Attributes, BASELINE_ATTRIBUTES } from './attributes.ts';

/** The nine defensive positions, plus the designated hitter. */
export type Position =
  | 'P'
  | 'C'
  | '1B'
  | '2B'
  | '3B'
  | 'SS'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'DH';

/** Pitcher-only ratings. Batters carry `null` here. */
export interface PitcherRatings {
  /** 0..1 — raw stuff. Higher misses more bats. */
  velocity: number;
  /** 0..1 — command of the zone. Higher walks fewer batters. */
  control: number;
  /** Batters this pitcher can face before tiring. Starters run deep. */
  stamina: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  attributes: Attributes;
  pitching: PitcherRatings | null;
}

export interface Team {
  name: string;
  /** The batting order, nine deep, index 0 leading off. */
  lineup: readonly Player[];
  /** Reserves available to substitute in. */
  bench: readonly Player[];
  /** Starting pitchers. `rotation[0]` takes the ball today. */
  rotation: readonly Player[];
  /** Relief pitchers, used in order as the starter tires. */
  bullpen: readonly Player[];
}

/** Batting order length. Nine hitters; the DH bats for the pitcher. */
export const LINEUP_SIZE = 9;
export const BENCH_SIZE = 5;
export const ROTATION_SIZE = 5;
export const BULLPEN_SIZE = 7;
/** 26 players — nine starters, five reserves, five starters, seven relievers. */
export const ROSTER_SIZE = LINEUP_SIZE + BENCH_SIZE + ROTATION_SIZE + BULLPEN_SIZE;

/** Defensive positions in batting-order slots, DH in place of the pitcher. */
const LINEUP_POSITIONS: readonly Position[] = [
  'CF',
  'SS',
  '1B',
  'DH',
  'LF',
  '3B',
  'RF',
  '2B',
  'C',
];

const FIRST_NAMES = [
  'Ace', 'Bolt', 'Cliff', 'Dex', 'Early', 'Flash', 'Gus', 'Hank', 'Iggy',
  'Jet', 'Knox', 'Lefty', 'Moose', 'Nico', 'Oz', 'Pip', 'Quill', 'Rusty',
  'Slate', 'Tank', 'Ugo', 'Vince', 'Whit', 'Xander', 'Yuri', 'Zeke',
] as const;

const LAST_NAMES = [
  'Blockman', 'Cobb', 'Dunn', 'Ellis', 'Fenwick', 'Grady', 'Hollis', 'Ives',
  'Jarrow', 'Keel', 'Lund', 'Marsh', 'Nash', 'Orr', 'Pace', 'Quint', 'Rowe',
  'Stack', 'Tuck', 'Vance', 'Ward', 'Yates', 'Zane', 'Ash', 'Brine', 'Crag',
] as const;

/** A bell-ish draw in [0, 1) centred on 0.5 — most players are average. */
function bell(rand: () => number): number {
  return (rand() + rand() + rand()) / 3;
}

/** Nudge a 0..1 rating toward `target` by `weight`, staying inside [0, 1]. */
function toward(value: number, target: number, weight: number): number {
  const v = value + (target - value) * weight;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function makeName(rand: () => number): string {
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function makeBatter(
  id: string,
  position: Position,
  rand: () => number,
  /** Batting-order slot quality: 0 = bottom of the order, 1 = the middle. */
  slotQuality: number,
): Player {
  const base = bell(rand);
  return {
    id,
    name: makeName(rand),
    position,
    attributes: {
      power: toward(bell(rand), 0.5 + slotQuality * 0.25, 0.5),
      contact: toward(base, 0.5 + slotQuality * 0.2, 0.5),
      speed: bell(rand),
    },
    pitching: null,
  };
}

function makePitcher(
  id: string,
  rand: () => number,
  starter: boolean,
  /** 0 = back of the staff, 1 = the ace. */
  quality: number,
): Player {
  return {
    id,
    name: makeName(rand),
    position: 'P',
    // Pitchers hit poorly; with a DH they rarely bat at all.
    attributes: { power: bell(rand) * 0.4, contact: bell(rand) * 0.4, speed: bell(rand) * 0.7 },
    pitching: {
      // Relievers throw harder in short bursts; starters pace themselves.
      velocity: toward(bell(rand), starter ? 0.45 + quality * 0.3 : 0.6 + quality * 0.3, 0.6),
      control: toward(bell(rand), starter ? 0.55 + quality * 0.25 : 0.45 + quality * 0.2, 0.6),
      stamina: starter
        ? Math.round(22 + quality * 8 + rand() * 4)
        : Math.round(5 + quality * 4 + rand() * 3),
    },
  };
}

/**
 * Batting-order slot quality: the 3-4-5 hitters are the best bats, the 8-9
 * slots the weakest. Returns 0..1.
 */
function slotQuality(slot: number): number {
  const distanceFromCleanup = Math.abs(slot - 3);
  return Math.max(0, 1 - distanceFromCleanup / 5);
}

/** Build a full {@link ROSTER_SIZE}-player club. Deterministic for a given `rand`. */
export function makeTeam(name: string, rand: () => number): Team {
  const lineup = LINEUP_POSITIONS.map((position, slot) =>
    makeBatter(`${name}-L${slot}`, position, rand, slotQuality(slot)),
  );

  const bench = Array.from({ length: BENCH_SIZE }, (_, i) =>
    makeBatter(`${name}-B${i}`, LINEUP_POSITIONS[i], rand, 0.2),
  );

  const rotation = Array.from({ length: ROTATION_SIZE }, (_, i) =>
    makePitcher(`${name}-SP${i}`, rand, true, 1 - i / ROTATION_SIZE),
  );

  const bullpen = Array.from({ length: BULLPEN_SIZE }, (_, i) =>
    makePitcher(`${name}-RP${i}`, rand, false, 1 - i / BULLPEN_SIZE),
  );

  return { name, lineup, bench, rotation, bullpen };
}

/** A league-average club with no randomness — handy for tests and defaults. */
export function makeBaselineTeam(name: string): Team {
  const batter = (id: string, position: Position): Player => ({
    id,
    name: `${name} ${position}`,
    position,
    attributes: { ...BASELINE_ATTRIBUTES },
    pitching: null,
  });
  const pitcher = (id: string, stamina: number): Player => ({
    id,
    name: `${name} ${id}`,
    position: 'P',
    attributes: { power: 0.2, contact: 0.2, speed: 0.4 },
    pitching: { velocity: 0.5, control: 0.5, stamina },
  });

  return {
    name,
    lineup: LINEUP_POSITIONS.map((p, i) => batter(`${name}-L${i}`, p)),
    bench: Array.from({ length: BENCH_SIZE }, (_, i) => batter(`${name}-B${i}`, 'DH')),
    rotation: Array.from({ length: ROTATION_SIZE }, (_, i) => pitcher(`SP${i}`, 26)),
    bullpen: Array.from({ length: BULLPEN_SIZE }, (_, i) => pitcher(`RP${i}`, 7)),
  };
}
