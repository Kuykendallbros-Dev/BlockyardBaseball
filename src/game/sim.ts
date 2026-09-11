/**
 * Headless game simulation — the whole `pitching → ai → swing → atbat → inning →
 * game` chain with no rendering. Used by the Phase 1 regression tests, and handy
 * later for "sim to the end of the game" or fast-forward features. The live scene
 * shares the same pure pieces but drives them frame by frame for the visuals.
 */

import { landingFrom, resolvePitch, type PitchOutcome } from './atbat.ts';
import { judgeSwing, launchVelocity } from './swing.ts';
import { rollPitch } from './pitching.ts';
import { type GameState, applyPitchToGame, newGame } from './game.ts';
import {
  type BatterAI,
  LEAGUE_AVERAGE_BATTER,
  batterDecision,
  zoneBiasForCount,
} from './ai.ts';

/** Where a simulated swing meets the ball (matches the scene's contact point). */
const CONTACT_POINT = [0, 1, 0.6] as const;

/** Resolve one pitch, with `batter` deciding whether and when to swing. */
export function simulatePitch(
  game: GameState,
  batter: BatterAI,
  rand: () => number,
): PitchOutcome {
  const pitch = rollPitch(rand, zoneBiasForCount(game.half));
  const decision = batterDecision(batter, pitch.inZone, rand);
  if (!decision.swing) return resolvePitch(null, pitch.inZone);

  const judgement = judgeSwing(decision.timingError);
  if (judgement.result !== 'contact' || !judgement.quality) {
    return resolvePitch(judgement, pitch.inZone);
  }

  const velocity = launchVelocity(decision.timingError, judgement.quality);
  return resolvePitch(
    judgement,
    pitch.inZone,
    landingFrom(CONTACT_POINT, velocity),
    rand,
  );
}

export interface SimResult {
  game: GameState;
  pitches: number;
}

/**
 * Play a full game AI vs AI. `maxPitches` default is generous: the fielding
 * model (`./fielding.ts`) is a placeholder pending Phase 2 attribute-driven
 * defense, and its "hard" dial still lets some fly balls fall in, so games
 * run longer and higher-scoring than a real 9-inning game until that lands.
 */
export function simulateGame(
  rand: () => number,
  away: BatterAI = LEAGUE_AVERAGE_BATTER,
  home: BatterAI = LEAGUE_AVERAGE_BATTER,
  maxPitches = 15000,
): SimResult {
  let game = newGame();
  let pitches = 0;
  while (!game.final && pitches < maxPitches) {
    const batter = game.halfIndex % 2 === 0 ? away : home;
    game = applyPitchToGame(game, simulatePitch(game, batter, rand));
    pitches += 1;
  }
  return { game, pitches };
}
