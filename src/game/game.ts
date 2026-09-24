/**
 * Pure full-game state — composes half-innings from `./inning.ts` into a nine
 * inning game with the real ending rules: the home team skips the bottom of the
 * ninth (or later) when already ahead, a tie goes to extra innings, and a home
 * team taking the lead in the bottom of the ninth or later ends it on the spot
 * (walk-off).
 *
 * It now also carries the two clubs: the batting order continues across
 * innings rather than restarting, and each side's starting pitcher gives way to
 * the bullpen once he has faced more batters than his stamina allows. No
 * rendering and no AI — just the score, who is due up, who is on the mound, and
 * when it ends.
 */

import type { PitchOutcome } from './atbat.ts';
import { type HalfInningState, applyPitch, newHalfInning } from './inning.ts';
import { type BattingSide, battingSide, inningNumber } from './scoreboard.ts';
import { type Player, type Team, makeBaselineTeam } from './roster.ts';

/** Nine innings, two halves each. */
export const REGULATION_HALVES = 18;

/** Who is on the mound for one side, and how long he has been out there. */
export interface PitcherState {
  pitcher: Player;
  /** Batters this pitcher has faced in this game. */
  battersFaced: number;
  /** How many arms deep into the bullpen we are. -1 = still the starter. */
  bullpenIndex: number;
}

export interface GameState {
  /** 0 = top 1, 1 = bottom 1, 2 = top 2, … */
  halfIndex: number;
  half: HalfInningState;
  score: { away: number; home: number };
  /** Runs in each half-inning played so far, indexed by half index. */
  lineScore: number[];
  final: boolean;
  winner: BattingSide | null;
  teams: { away: Team; home: Team };
  /** Next batting-order slot due up for each side. */
  dueUp: { away: number; home: number };
  /** The pitcher each side currently has on the mound. */
  pitching: { away: PitcherState; home: PitcherState };
}

function openingPitcher(team: Team): PitcherState {
  return { pitcher: team.rotation[0], battersFaced: 0, bullpenIndex: -1 };
}

export function newGame(teams?: { away: Team; home: Team }): GameState {
  const clubs = teams ?? {
    away: makeBaselineTeam('Away'),
    home: makeBaselineTeam('Home'),
  };
  return {
    halfIndex: 0,
    half: newHalfInning(),
    score: { away: 0, home: 0 },
    lineScore: [],
    final: false,
    winner: null,
    teams: clubs,
    dueUp: { away: 0, home: 0 },
    pitching: {
      away: openingPitcher(clubs.away),
      home: openingPitcher(clubs.home),
    },
  };
}

/** The batter currently at the plate. */
export function batterAtPlate(game: GameState): Player {
  const side = battingSide(game.halfIndex);
  return game.teams[side].lineup[game.half.battingOrderIndex];
}

/** The pitcher currently on the mound — the fielding side's arm. */
export function pitcherOnMound(game: GameState): PitcherState {
  const fielding: BattingSide = battingSide(game.halfIndex) === 'away' ? 'home' : 'away';
  return game.pitching[fielding];
}

/**
 * Hand the ball to the next arm once the current one is past his stamina.
 * Starters go first, then the bullpen in order; the last reliever finishes the
 * game however long it runs, so a game can never stall for want of a pitcher.
 */
function maybeChangePitcher(team: Team, state: PitcherState): PitcherState {
  const stamina = state.pitcher.pitching?.stamina ?? 27;
  if (state.battersFaced < stamina) return state;

  const nextIndex = state.bullpenIndex + 1;
  if (nextIndex >= team.bullpen.length) return state; // last man standing
  return {
    pitcher: team.bullpen[nextIndex],
    battersFaced: 0,
    bullpenIndex: nextIndex,
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
 * this on a final game returns it unchanged. `rand` settles the baserunning
 * judgement calls in `./inning.ts`.
 */
export function applyPitchToGame(
  game: GameState,
  outcome: PitchOutcome,
  rand: () => number = () => 0.5,
): GameState {
  if (game.final) return game;

  const side = battingSide(game.halfIndex);
  const fielding: BattingSide = side === 'away' ? 'home' : 'away';
  const nextHalf = applyPitch(game.half, outcome, rand);
  const runs = nextHalf.runs - game.half.runs;

  const score = { ...game.score };
  if (runs > 0) score[side] += runs;

  const lineScore = [...game.lineScore];
  lineScore[game.halfIndex] = nextHalf.runs;

  // Charge the plate appearance to whoever is on the mound, then see whether
  // he has thrown himself out of the game.
  const plateAppearanceEnded = nextHalf.battersFaced > game.half.battersFaced;
  const pitching = { ...game.pitching };
  if (plateAppearanceEnded) {
    const worked: PitcherState = {
      ...pitching[fielding],
      battersFaced: pitching[fielding].battersFaced + 1,
    };
    pitching[fielding] = maybeChangePitcher(game.teams[fielding], worked);
  }

  const dueUp = { ...game.dueUp, [side]: nextHalf.battingOrderIndex };

  const ending = endingFor(game.halfIndex, score, nextHalf.over);
  if (ending) {
    return { ...game, half: nextHalf, score, lineScore, pitching, dueUp, ...ending };
  }

  if (!nextHalf.over) {
    return { ...game, half: nextHalf, score, lineScore, pitching, dueUp };
  }

  const nextSide = battingSide(game.halfIndex + 1);
  return {
    ...game,
    halfIndex: game.halfIndex + 1,
    half: newHalfInning(dueUp[nextSide]),
    score,
    lineScore,
    pitching,
    dueUp,
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
