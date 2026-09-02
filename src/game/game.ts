/**
 * Pure full-game state — composes half-innings from `./inning.ts` into a nine
 * inning game with the real ending rules: the home team skips the bottom of the
 * ninth (or later) when already ahead, a tie goes to extra innings, and a home
 * team taking the lead in the bottom of the ninth or later ends it on the spot
 * (walk-off). No rendering, no lineup, no AI — just the score and when it ends.
 */

import type { PitchOutcome } from './atbat.ts';
import { type HalfInningState, applyPitch, newHalfInning } from './inning.ts';
import { type BattingSide, battingSide, inningNumber } from './scoreboard.ts';

/** Nine innings, two halves each. */
export const REGULATION_HALVES = 18;

export interface GameState {
  /** 0 = top 1, 1 = bottom 1, 2 = top 2, … */
  halfIndex: number;
  half: HalfInningState;
  score: { away: number; home: number };
  /** Runs in each half-inning played so far, indexed by half index. */
  lineScore: number[];
  final: boolean;
  winner: BattingSide | null;
}

export function newGame(): GameState {
  return {
    halfIndex: 0,
    half: newHalfInning(),
    score: { away: 0, home: 0 },
    lineScore: [],
    final: false,
    winner: null,
  };
}

interface Ending {
  final: true;
  winner: BattingSide;
}

/**
 * Decide whether the game is over. `halfJustEnded` is true when the current
 * half-inning reached its third out on this pitch.
 */
function endingFor(
  halfIndex: number,
  score: GameState['score'],
  halfJustEnded: boolean,
): Ending | null {
  const inning = inningNumber(halfIndex);
  const isBottom = halfIndex % 2 === 1;
  if (inning < 9) return null;

  // Walk-off: home takes the lead batting in the bottom of the 9th or later.
  if (isBottom && score.home > score.away) {
    return { final: true, winner: 'home' };
  }
  if (!halfJustEnded) return null;

  // Top half over and the home team is already ahead — no need to bat.
  if (!isBottom && score.home > score.away) {
    return { final: true, winner: 'home' };
  }
  // Bottom half over with someone ahead — that's the game.
  if (isBottom && score.away !== score.home) {
    return {
      final: true,
      winner: score.home > score.away ? 'home' : 'away',
    };
  }
  return null;
}

/**
 * Apply one pitch outcome to the whole game. The input is not mutated. Calling
 * this on a final game returns it unchanged.
 */
export function applyPitchToGame(
  game: GameState,
  outcome: PitchOutcome,
): GameState {
  if (game.final) return game;

  const side = battingSide(game.halfIndex);
  const nextHalf = applyPitch(game.half, outcome);
  const runs = nextHalf.runs - game.half.runs;

  const score = { ...game.score };
  if (runs > 0) score[side] += runs;

  const lineScore = [...game.lineScore];
  lineScore[game.halfIndex] = nextHalf.runs;

  const ending = endingFor(game.halfIndex, score, nextHalf.over);
  if (ending) {
    return { ...game, half: nextHalf, score, lineScore, ...ending };
  }

  if (!nextHalf.over) {
    return { ...game, half: nextHalf, score, lineScore };
  }

  return {
    halfIndex: game.halfIndex + 1,
    half: newHalfInning(),
    score,
    lineScore,
    final: false,
    winner: null,
  };
}

/** Line score split into per-inning runs for each side. */
export function lineScoreByInning(game: GameState): {
  away: number[];
  home: number[];
} {
  const away: number[] = [];
  const home: number[] = [];
  game.lineScore.forEach((runs, half) => {
    if (half % 2 === 0) away.push(runs);
    else home.push(runs);
  });
  return { away, home };
}
