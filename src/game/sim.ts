/**
 * Headless game simulation — the whole `roster → pitching → ai → swing → atbat →
 * inning → game` chain with no rendering. Used by the Phase 1 regression tests
 * and the balance suite, and handy later for "sim to the end of the game" or
 * fast-forward features. The live scene shares the same pure pieces but drives
 * them frame by frame for the visuals.
 *
 * Every batter is the man actually due up in the order, with his own
 * attributes, and every pitch comes from whoever is on the mound — so a tiring
 * starter and a weak bottom of the order both show up in the box score.
 */

import { landingFrom, resolvePitch, type PitchOutcome } from './atbat.ts';
import { judgeSwing, launchVelocity } from './swing.ts';
import { rollPitch } from './pitching.ts';
import {
  type GameState,
  applyPitchToGame,
  batterAtPlate,
  newGame,
  pitcherOnMound,
} from './game.ts';
import { type Team } from './roster.ts';
import { contactMultiplier, powerMultiplier } from './attributes.ts';
import { batterAIFor, batterDecision, zoneBiasForCount } from './ai.ts';

/** Where a simulated swing meets the ball (matches the scene's contact point). */
const CONTACT_POINT = [0, 1, 0.6] as const;

/** Resolve one pitch between whoever is due up and whoever is on the mound. */
export function simulatePitch(game: GameState, rand: () => number): PitchOutcome {
  const batter = batterAtPlate(game);
  const mound = pitcherOnMound(game);
  const arm = mound.pitcher.pitching;

  // A pitcher with command lives in the zone; one without it falls behind. A
  // tiring pitcher loses the zone too, which is how the bullpen earns its keep.
  const stamina = arm?.stamina ?? 27;
  const fatigue = Math.max(0, mound.battersFaced - stamina) * 0.02;
  const control = (arm?.control ?? 0.5) - fatigue;
  const commandBias = (control - 0.5) * 0.3;

  const pitch = rollPitch(rand, zoneBiasForCount(game.half) + commandBias);
  const ai = batterAIFor(batter.attributes);
  const decision = batterDecision(ai, pitch.inZone, rand);
  if (!decision.swing) return resolvePitch(null, pitch.inZone);

  // Velocity is what misses bats: it eats into the batter's contact window.
  const stuff = 1 - ((arm?.velocity ?? 0.5) - 0.5) * 0.35;
  const judgement = judgeSwing(
    decision.timingError,
    contactMultiplier(batter.attributes.contact) * stuff,
  );
  if (judgement.result !== 'contact' || !judgement.quality) {
    return resolvePitch(judgement, pitch.inZone);
  }

  const velocity = launchVelocity(
    decision.timingError,
    judgement.quality,
    powerMultiplier(batter.attributes.power),
    rand,
  );
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
 * Play a full game, club against club. `maxPitches` is a safety valve only — a
 * balanced game finishes in roughly 270–330 pitches, so hitting the cap means
 * something in the rules has regressed.
 */
export function simulateGame(
  rand: () => number,
  teams?: { away: Team; home: Team },
  maxPitches = 2000,
): SimResult {
  let game = newGame(teams);
  let pitches = 0;
  while (!game.final && pitches < maxPitches) {
    game = applyPitchToGame(game, simulatePitch(game, rand), rand);
    pitches += 1;
  }
  return { game, pitches };
}
