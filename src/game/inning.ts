/**
 * Pure count- and half-inning bookkeeping. Feed it the {@link PitchOutcome}
 * values from `./atbat.ts` and it tracks balls / strikes / outs, baserunners,
 * and runs, ending the half-inning at the third out. No rendering, no game-level
 * loop (that is P1-5) — just one team's turn at bat.
 *
 * Baserunning is deliberately simple: every runner advances exactly the number
 * of bases the batter earned. So a single scores a runner from third, a double
 * scores runners from second and third, a triple clears the bases. Smarter,
 * situational baserunning is a later task.
 */

import type { PitchOutcome } from './atbat.ts';

/** Occupancy of first, second, third. */
export type BaseState = readonly [boolean, boolean, boolean];

export const EMPTY_BASES: BaseState = [false, false, false];

export interface HalfInningState {
  balls: number;
  strikes: number;
  outs: number;
  bases: BaseState;
  /** Runs scored so far this half-inning. */
  runs: number;
  /** True once the third out is recorded. */
  over: boolean;
  /** One-line description of the most recent pitch's effect. */
  lastEvent: string;
}

export function newHalfInning(): HalfInningState {
  return {
    balls: 0,
    strikes: 0,
    outs: 0,
    bases: EMPTY_BASES,
    runs: 0,
    over: false,
    lastEvent: 'leadoff batter',
  };
}

function advanceOnHit(
  bases: BaseState,
  batterBases: 1 | 2 | 3 | 4,
): { bases: BaseState; runs: number } {
  const next: [boolean, boolean, boolean] = [false, false, false];
  let runs = 0;

  const starts = [bases[0] ? 1 : 0, bases[1] ? 2 : 0, bases[2] ? 3 : 0];
  for (const from of starts) {
    if (from === 0) continue;
    const to = from + batterBases;
    if (to >= 4) runs += 1;
    else next[to - 1] = true;
  }

  if (batterBases >= 4) runs += 1;
  else next[batterBases - 1] = true;

  return { bases: next, runs };
}

function advanceOnWalk(bases: BaseState): { bases: BaseState; runs: number } {
  const next: [boolean, boolean, boolean] = [bases[0], bases[1], bases[2]];
  if (!next[0]) next[0] = true;
  else if (!next[1]) next[1] = true;
  else if (!next[2]) next[2] = true;
  else return { bases: [true, true, true], runs: 1 };
  return { bases: next, runs: 0 };
}

const HIT_LABEL_BASES: Record<string, 1 | 2 | 3 | 4> = {
  single: 1,
  double: 2,
  triple: 3,
  'home run': 4,
};

/**
 * Apply one pitch outcome and return the next half-inning state. The input state
 * is not mutated. Calling this on an already-over half-inning returns it
 * unchanged.
 */
export function applyPitch(
  state: HalfInningState,
  outcome: PitchOutcome,
): HalfInningState {
  if (state.over) return state;

  const next: HalfInningState = { ...state };

  const recordOut = (label: string): void => {
    next.outs = state.outs + 1;
    next.balls = 0;
    next.strikes = 0;
    next.over = next.outs >= 3;
    next.lastEvent = next.over ? `${label} — side retired` : label;
  };

  switch (outcome.kind) {
    case 'ball': {
      next.balls = state.balls + 1;
      if (next.balls >= 4) {
        const { bases, runs } = advanceOnWalk(state.bases);
        next.bases = bases;
        next.runs = state.runs + runs;
        next.balls = 0;
        next.strikes = 0;
        next.lastEvent = runs > 0 ? 'walk, run forced in' : 'walk';
      } else {
        next.lastEvent = `ball ${next.balls}`;
      }
      break;
    }

    case 'called-strike':
    case 'swinging-strike': {
      next.strikes = state.strikes + 1;
      if (next.strikes >= 3) {
        recordOut(
          outcome.kind === 'called-strike' ? 'strikeout looking' : 'strikeout',
        );
      } else {
        next.lastEvent =
          outcome.kind === 'called-strike'
            ? `called strike ${next.strikes}`
            : `swinging strike ${next.strikes}`;
      }
      break;
    }

    case 'foul': {
      if (state.strikes < 2) next.strikes = state.strikes + 1;
      next.lastEvent = `foul${next.strikes === 2 ? ' (2 strikes)' : ''}`;
      break;
    }

    case 'in-play': {
      const { play } = outcome;
      if (!play.hit) {
        recordOut(play.label);
      } else {
        const { bases, runs } = advanceOnHit(
          state.bases,
          HIT_LABEL_BASES[play.label],
        );
        next.bases = bases;
        next.runs = state.runs + runs;
        next.balls = 0;
        next.strikes = 0;
        next.lastEvent = runs > 0 ? `${play.label}, ${runs} in` : play.label;
      }
      break;
    }
  }

  return next;
}
