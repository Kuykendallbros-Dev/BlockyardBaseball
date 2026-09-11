/**
 * Phase 1 regression: a full nine-inning game, AI vs AI, over many seeds. If any
 * of the pure pieces (`atbat`, `inning`, `game`, `ai`, `pitching`) regress into
 * a hang, a tie, or an incoherent box score, this catches it.
 */

import { describe, expect, it } from 'vitest';
import type { BatterAI } from './ai.ts';
import { lineScoreByInning } from './game.ts';
import { simulateGame } from './sim.ts';

/** Mulberry32 — deterministic, reproducible per seed. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('full game simulation', () => {
  it('always finishes with a coherent box score', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { game, pitches } = simulateGame(rng(seed));

      expect(game.final).toBe(true);
      expect(game.winner).not.toBeNull();
      expect(game.score.away).not.toBe(game.score.home);
      // Generous cap: `fielding.ts` is a placeholder pending Phase 2
      // attribute-driven defense, so games run longer than a real 9 innings.
      expect(pitches).toBeLessThan(15000);

      const winnerRuns =
        game.winner === 'home' ? game.score.home : game.score.away;
      const loserRuns =
        game.winner === 'home' ? game.score.away : game.score.home;
      expect(winnerRuns).toBeGreaterThan(loserRuns);

      // line score reconciles to the final
      const line = lineScoreByInning(game);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(sum(line.away)).toBe(game.score.away);
      expect(sum(line.home)).toBe(game.score.home);
      expect(line.away.length).toBeGreaterThanOrEqual(9);
    }
  });

  it('at least nine full innings unless the home team walked it off', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { game } = simulateGame(rng(seed));
      const halvesPlayed = game.lineScore.length;
      // 17 = home led after the top of the 9th and didn't bat; 18 = full 9;
      // anything more is extra innings. Fewer than 17 should never happen.
      expect(halvesPlayed).toBeGreaterThanOrEqual(17);
    }
  });

  it('a clearly better lineup wins the large majority of games', () => {
    const ace: BatterAI = {
      chaseRate: 0.15,
      zoneSwingRate: 0.78,
      timingSigma: 0.055,
      power: 0.9,
    };
    const scrub: BatterAI = {
      chaseRate: 0.4,
      zoneSwingRate: 0.55,
      timingSigma: 0.16,
      power: 0.2,
    };

    let aceWins = 0;
    for (let seed = 1; seed <= 120; seed++) {
      // ace bats home so it also gets the walk-off edge; fine for a strength check
      const { game } = simulateGame(rng(seed), scrub, ace);
      if (game.winner === 'home') aceWins += 1;
    }
    expect(aceWins).toBeGreaterThan(90);
  });
});
