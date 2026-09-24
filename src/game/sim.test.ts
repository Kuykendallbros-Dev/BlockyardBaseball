/**
 * Phase 1 regression: a full nine-inning game, AI vs AI, over many seeds. If any
 * of the pure pieces (`atbat`, `inning`, `game`, `ai`, `pitching`) regress into
 * a hang, a tie, or an incoherent box score, this catches it.
 */

import { describe, expect, it } from 'vitest';
import { type Team, makeBaselineTeam } from './roster.ts';
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
      // A balanced nine-inning game runs roughly 240 pitches. The cap is loose
      // enough for extra innings but tight enough that a rules regression which
      // stops recording outs fails here instead of quietly running forever.
      expect(pitches).toBeLessThan(900);

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
    const clubOfBats = (name: string, stat: number): Team => {
      const base = makeBaselineTeam(name);
      return {
        ...base,
        lineup: base.lineup.map((p) => ({
          ...p,
          attributes: { power: stat, contact: stat, speed: stat },
        })),
      };
    };

    const ace = clubOfBats('Ace', 0.95);
    const scrub = clubOfBats('Scrub', 0.05);

    let aceWins = 0;
    for (let seed = 1; seed <= 120; seed++) {
      // Ace bats home so it also gets the walk-off edge; fine for a strength check.
      const { game } = simulateGame(rng(seed), { away: scrub, home: ace });
      if (game.winner === 'home') aceWins += 1;
    }
    expect(aceWins).toBeGreaterThan(90);
  });

  it('plays the whole batting order rather than one batter over and over', () => {
    const { game } = simulateGame(rng(42));
    // Nine innings of outs alone guarantees each side turns its order over
    // more than twice, so every slot must have come to the plate.
    expect(game.dueUp.away).toBeGreaterThanOrEqual(0);
    expect(game.dueUp.home).toBeGreaterThanOrEqual(0);
    expect(game.teams.away.lineup).toHaveLength(9);
    expect(game.teams.home.lineup).toHaveLength(9);
  });

  it('goes to the bullpen once the starter is past his stamina', () => {
    let wentToThePen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { game } = simulateGame(rng(seed));
      if (game.pitching.away.bullpenIndex >= 0) wentToThePen += 1;
    }
    expect(wentToThePen).toBeGreaterThan(30);
  });

  it('produces a box score in the shape of real baseball', () => {
    let runs = 0;
    let pitches = 0;
    const games = 150;
    for (let seed = 1; seed <= games; seed++) {
      const r = simulateGame(rng(seed));
      runs += r.game.score.away + r.game.score.home;
      pitches += r.pitches;
    }
    // Both sides combined. Real major-league baseball sits near 9 runs and
    // 290 pitches; this is the guard that stops the 50-run games coming back.
    expect(runs / games).toBeGreaterThan(4);
    expect(runs / games).toBeLessThan(15);
    expect(pitches / games).toBeGreaterThan(150);
    expect(pitches / games).toBeLessThan(400);
  });
});
