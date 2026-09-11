/**
 * Battle pass — Phase 4's essential path. A single free track that fills from
 * match activity: play a match, earn pass points, level up, get a small coin
 * reward. No premium tier and no IAP scaffolding yet — see the Phase 4
 * enhancement backlog (neither is worth building before there's a real
 * payment processor to attach it to).
 */

import type { GameState } from './game.ts';
import type { BattingSide } from './scoreboard.ts';

export const PASS_MAX_LEVEL = 10;
export const POINTS_PER_LEVEL = 100;
const LEVEL_REWARD_COINS = 50;

export interface PassState {
  points: number;
}

export function newPass(): PassState {
  return { points: 0 };
}

/** Pass points earned from one finished match, from `humanSide`'s perspective. */
export function pointsFor(game: GameState, humanSide: BattingSide): number {
  if (!game.final) return 0;
  const runs = humanSide === 'home' ? game.score.home : game.score.away;
  const won = game.winner === humanSide;
  return 20 + runs * 2 + (won ? 30 : 0);
}

function levelFor(points: number): number {
  return Math.min(PASS_MAX_LEVEL, Math.floor(points / POINTS_PER_LEVEL) + 1);
}

export interface PassProgress {
  level: number;
  /** Points earned within the current level. */
  intoLevel: number;
  /** Points needed to complete a level. */
  needed: number;
  maxed: boolean;
}

export function progressFor(points: number): PassProgress {
  const level = levelFor(points);
  const maxed = level >= PASS_MAX_LEVEL;
  const intoLevel = maxed ? POINTS_PER_LEVEL : points % POINTS_PER_LEVEL;
  return { level, intoLevel, needed: POINTS_PER_LEVEL, maxed };
}

export interface PassGain {
  state: PassState;
  levelsGained: number;
  coinsAwarded: number;
}

/** Advance the pass by `points`, capped at the max level. */
export function applyPassGain(state: PassState, points: number): PassGain {
  const before = levelFor(state.points);
  const cap = PASS_MAX_LEVEL * POINTS_PER_LEVEL;
  const total = Math.min(state.points + Math.max(0, points), cap);
  const after = levelFor(total);
  const levelsGained = after - before;
  return {
    state: { points: total },
    levelsGained,
    coinsAwarded: levelsGained * LEVEL_REWARD_COINS,
  };
}
