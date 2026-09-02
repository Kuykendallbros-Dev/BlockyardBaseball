import { describe, expect, it } from 'vitest';
import { LEAGUE_AVERAGE_BATTER, batterDecision, zoneBiasForCount } from './ai.ts';
import { newHalfInning } from './inning.ts';

const always = (v: number) => () => v;

describe('batterDecision', () => {
  it('never swings when the roll clears the swing probability', () => {
    expect(batterDecision(LEAGUE_AVERAGE_BATTER, true, always(0.99)).swing).toBe(false);
  });

  it('swings early when it commits and the timing roll is low', () => {
    const d = batterDecision(LEAGUE_AVERAGE_BATTER, true, always(0));
    expect(d.swing).toBe(true);
    expect(d.timingError).toBeLessThan(0);
  });

  it('chases out of the zone far less often than it swings in the zone', () => {
    let zoneSwings = 0;
    let chases = 0;
    let seed = 1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 4000; i++) {
      if (batterDecision(LEAGUE_AVERAGE_BATTER, true, rand).swing) zoneSwings++;
      if (batterDecision(LEAGUE_AVERAGE_BATTER, false, rand).swing) chases++;
    }
    expect(zoneSwings).toBeGreaterThan(chases * 1.5);
  });
});

describe('zoneBiasForCount', () => {
  it('grooves one when behind 3-0 and expands with two strikes', () => {
    expect(zoneBiasForCount({ ...newHalfInning(), balls: 3, strikes: 0 })).toBeGreaterThan(0);
    expect(zoneBiasForCount({ ...newHalfInning(), balls: 0, strikes: 2 })).toBeLessThan(0);
    expect(zoneBiasForCount({ ...newHalfInning(), balls: 1, strikes: 1 })).toBe(0);
  });
});
