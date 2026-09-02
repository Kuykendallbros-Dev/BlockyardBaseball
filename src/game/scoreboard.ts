/**
 * Pure formatting for the scoreboard readout. Takes the half-inning state from
 * `./inning.ts` plus a running score and produces the strings the HUD shows. No
 * DOM here — the scene owns the element.
 */

import type { BaseState, HalfInningState } from './inning.ts';

export interface Score {
  away: number;
  home: number;
}

/** The away team bats in the top half, the home team in the bottom. */
export type BattingSide = 'away' | 'home';

export function inningNumber(halfIndex: number): number {
  return Math.floor(halfIndex / 2) + 1;
}

export function battingSide(halfIndex: number): BattingSide {
  return halfIndex % 2 === 0 ? 'away' : 'home';
}

/** `0 -> "TOP 1"`, `1 -> "BOT 1"`, `2 -> "TOP 2"`, ... */
export function halfInningLabel(halfIndex: number): string {
  const half = halfIndex % 2 === 0 ? 'TOP' : 'BOT';
  return `${half} ${inningNumber(halfIndex)}`;
}

export function countLabel(balls: number, strikes: number): string {
  return `${balls}-${strikes}`;
}

export function outsLabel(outs: number): string {
  return outs === 1 ? '1 out' : `${outs} outs`;
}

export function basesLabel(bases: BaseState): string {
  const [first, second, third] = bases;
  if (!first && !second && !third) return 'bases empty';
  if (first && second && third) return 'bases loaded';
  if (first && third) return 'corners';
  if (first && second) return '1st & 2nd';
  if (second && third) return '2nd & 3rd';
  if (first) return 'runner on 1st';
  if (second) return 'runner on 2nd';
  return 'runner on 3rd';
}

export function scoreLabel(score: Score): string {
  return `AWAY ${score.away}  HOME ${score.home}`;
}

/** The full one-line scoreboard. */
export function formatScoreboard(
  halfIndex: number,
  state: HalfInningState,
  score: Score,
): string {
  return [
    halfInningLabel(halfIndex),
    countLabel(state.balls, state.strikes),
    outsLabel(state.outs),
    basesLabel(state.bases),
    scoreLabel(score),
  ].join('  ·  ');
}
