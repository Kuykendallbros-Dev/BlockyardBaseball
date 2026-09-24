/**
 * Count-, baserunner- and half-inning bookkeeping. Feed it the
 * {@link PitchOutcome} values from `./atbat.ts` and it tracks balls / strikes /
 * outs, who is on base, and runs, ending the half-inning at the third out.
 *
 * Baserunning follows real baseball rather than the old "everyone advances the
 * same number of bases" shortcut: runners take an extra base on hits some of
 * the time, a ground ball with a force at first can turn two, a fly ball scores
 * a runner from third on a sacrifice, and a runner can tag up from second. The
 * batting order persists across half-innings, so next inning's leadoff hitter
 * is whoever follows the last batter retired.
 *
 * Pure: `rand` in [0, 1) settles every judgement call and defaults to a
 * deterministic midpoint so classification stays testable.
 */

import type { PitchOutcome } from './atbat.ts';
import type { BattedBallType } from './fielding.ts';
import { LINEUP_SIZE } from './roster.ts';

/** Occupancy of first, second, third. */
export type BaseState = readonly [boolean, boolean, boolean];

export const EMPTY_BASES: BaseState = [false, false, false];

/**
 * How often a runner takes the extra base, by situation. These are set to
 * real-world frequencies rather than picked by feel.
 */
const ADVANCE = {
  /** Runner on first goes first-to-third on a single. */
  firstToThirdOnSingle: 0.28,
  /** Runner on second scores on a single. */
  secondToHomeOnSingle: 0.6,
  /** Runner on first scores on a double. */
  firstToHomeOnDouble: 0.45,
  /** A ground ball with a force at first and under two outs turns two. */
  doublePlay: 0.42,
  /** A fly ball with a runner on third and under two outs scores him. */
  sacrificeFly: 0.52,
  /** A fly ball with a runner on second and under two outs moves him up. */
  tagUpFromSecond: 0.18,
} as const;

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
  /** Batting-order slot at the plate, 0..{@link LINEUP_SIZE} - 1. */
  battingOrderIndex: number;
  /** Plate appearances completed this half-inning. */
  battersFaced: number;
}

export function newHalfInning(battingOrderIndex = 0): HalfInningState {
  return {
    balls: 0,
    strikes: 0,
    outs: 0,
    bases: EMPTY_BASES,
    runs: 0,
    over: false,
    lastEvent: 'leadoff batter',
    battingOrderIndex,
    battersFaced: 0,
  };
}

type MutableBases = [boolean, boolean, boolean];

/**
 * Advance the runners on a hit. The batter always takes `batterBases`; runners
 * take that many as a floor and sometimes one more, which is where singles that
 * score a man from second come from.
 */
function advanceOnHit(
  bases: BaseState,
  batterBases: 1 | 2 | 3 | 4,
  rand: () => number,
): { bases: BaseState; runs: number } {
  const next: MutableBases = [false, false, false];
  let runs = 0;

  const send = (from: 1 | 2 | 3, extra: boolean): void => {
    const to = from + batterBases + (extra ? 1 : 0);
    if (to >= 4) runs += 1;
    else next[to - 1] = true;
  };

  // Lead runner first, so a trailing runner is never put on an occupied base.
  if (bases[2]) send(3, false);
  if (bases[1]) {
    send(2, batterBases === 1 && rand() < ADVANCE.secondToHomeOnSingle);
  }
  if (bases[0]) {
    const extra =
      (batterBases === 1 && rand() < ADVANCE.firstToThirdOnSingle) ||
      (batterBases === 2 && rand() < ADVANCE.firstToHomeOnDouble);
    send(1, extra);
  }

  if (batterBases >= 4) runs += 1;
  else next[batterBases - 1] = true;

  return { bases: next, runs };
}

/** A walk or an error: the batter takes first and forced runners move up. */
function advanceOnForcedBase(bases: BaseState): { bases: BaseState; runs: number } {
  const next: MutableBases = [bases[0], bases[1], bases[2]];
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
 * Apply one pitch outcome and return the next half-inning state. The input
 * state is not mutated. Calling this on an already-over half-inning returns it
 * unchanged.
 */
export function applyPitch(
  state: HalfInningState,
  outcome: PitchOutcome,
  rand: () => number = () => 0.5,
): HalfInningState {
  if (state.over) return state;

  const next: HalfInningState = { ...state };

  /** Close out the plate appearance: reset the count, move the order along. */
  const endPlateAppearance = (): void => {
    next.balls = 0;
    next.strikes = 0;
    next.battingOrderIndex = (state.battingOrderIndex + 1) % LINEUP_SIZE;
    next.battersFaced = state.battersFaced + 1;
  };

  const addOuts = (count: number, label: string): void => {
    next.outs = Math.min(3, state.outs + count);
    next.over = next.outs >= 3;
    next.lastEvent = next.over ? `${label} — side retired` : label;
  };

  switch (outcome.kind) {
    case 'ball': {
      next.balls = state.balls + 1;
      if (next.balls >= 4) {
        const { bases, runs } = advanceOnForcedBase(state.bases);
        next.bases = bases;
        next.runs = state.runs + runs;
        next.lastEvent = runs > 0 ? 'walk, run forced in' : 'walk';
        endPlateAppearance();
      } else {
        next.lastEvent = `ball ${next.balls}`;
      }
      break;
    }

    case 'called-strike':
    case 'swinging-strike': {
      next.strikes = state.strikes + 1;
      if (next.strikes >= 3) {
        addOuts(
          1,
          outcome.kind === 'called-strike' ? 'strikeout looking' : 'strikeout',
        );
        endPlateAppearance();
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

      if (play.error) {
        const { bases, runs } = advanceOnForcedBase(state.bases);
        next.bases = bases;
        next.runs = state.runs + runs;
        next.lastEvent = 'reached on an error';
        endPlateAppearance();
        break;
      }

      if (play.hit) {
        const { bases, runs } = advanceOnHit(
          state.bases,
          HIT_LABEL_BASES[play.label],
          rand,
        );
        next.bases = bases;
        next.runs = state.runs + runs;
        next.lastEvent = runs > 0 ? `${play.label}, ${runs} in` : play.label;
        endPlateAppearance();
        break;
      }

      applyOutInPlay(state, next, play.battedBallType, rand, addOuts);
      endPlateAppearance();
      break;
    }
  }

  return next;
}

/**
 * An out on a ball in play — the part with real baseball in it. A ground ball
 * with a force at first can turn two; a fly ball under two outs can score a
 * runner from third and move one up from second. A run never scores on a play
 * that records the third out.
 */
function applyOutInPlay(
  state: HalfInningState,
  next: HalfInningState,
  battedBallType: BattedBallType,
  rand: () => number,
  addOuts: (count: number, label: string) => void,
): void {
  const bases: MutableBases = [state.bases[0], state.bases[1], state.bases[2]];
  const underTwoOuts = state.outs < 2;

  if (battedBallType === 'ground' && bases[0] && underTwoOuts) {
    if (rand() < ADVANCE.doublePlay) {
      // Around the horn: the lead runner and the batter. The inning may end on
      // it, in which case nothing scores.
      const inningEnds = state.outs + 2 >= 3;
      next.bases = inningEnds ? EMPTY_BASES : [false, false, bases[1]];
      next.runs = state.runs + (inningEnds || !bases[2] ? 0 : 1);
      addOuts(2, 'double play');
      return;
    }
    // Force at second, batter safe at first.
    next.bases = [true, bases[1], false];
    next.runs = state.runs + (bases[2] ? 1 : 0);
    addOuts(1, "fielder's choice");
    return;
  }

  if (battedBallType === 'fly' && underTwoOuts) {
    let runs = 0;
    if (bases[2] && rand() < ADVANCE.sacrificeFly) {
      bases[2] = false;
      runs = 1;
    }
    if (bases[1] && !bases[2] && rand() < ADVANCE.tagUpFromSecond) {
      bases[1] = false;
      bases[2] = true;
    }
    next.bases = bases;
    next.runs = state.runs + runs;
    addOuts(1, runs > 0 ? 'sacrifice fly, 1 in' : 'flyout');
    return;
  }

  next.bases = bases;
  const label =
    battedBallType === 'line'
      ? 'lineout'
      : battedBallType === 'popup'
        ? 'popout'
        : 'groundout';
  addOuts(1, label);
}
