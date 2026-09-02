import { describe, expect, it } from 'vitest';
import type { PitchOutcome } from './atbat.ts';
import {
  applyPitchToGame,
  lineScoreByInning,
  newGame,
  type GameState,
} from './game.ts';

const out: PitchOutcome = {
  kind: 'in-play',
  play: { hit: false, bases: 0, label: 'flyout' },
};
const homer: PitchOutcome = {
  kind: 'in-play',
  play: { hit: true, bases: 4, label: 'home run' },
};

/** Play the current half-inning: `homers` solo shots, then three outs. */
function playHalf(game: GameState, homers: number): GameState {
  let g = game;
  for (let i = 0; i < homers; i++) g = applyPitchToGame(g, homer);
  for (let i = 0; i < 3; i++) g = applyPitchToGame(g, out);
  return g;
}

describe('newGame', () => {
  it('opens in the top of the first, nobody out, 0-0', () => {
    const g = newGame();
    expect(g.halfIndex).toBe(0);
    expect(g.score).toEqual({ away: 0, home: 0 });
    expect(g.final).toBe(false);
  });
});

describe('ending rules', () => {
  it('away wins a regulation game it led wire to wire', () => {
    let g = newGame();
    for (let h = 0; h < 18 && !g.final; h++) g = playHalf(g, h === 0 ? 1 : 0);
    expect(g.final).toBe(true);
    expect(g.winner).toBe('away');
    expect(g.score).toEqual({ away: 1, home: 0 });
  });

  it('does not play the bottom of the ninth when the home team is already ahead', () => {
    let g = newGame();
    for (let h = 0; h < 18 && !g.final; h++) g = playHalf(g, h === 1 ? 2 : 0);
    expect(g.final).toBe(true);
    expect(g.winner).toBe('home');
    expect(g.halfIndex).toBe(16); // game ended as the top of the 9th finished
  });

  it('goes to extra innings on a tie', () => {
    let g = newGame();
    for (let h = 0; h < 18 && !g.final; h++) g = playHalf(g, 0);
    expect(g.final).toBe(false);
    expect(g.halfIndex).toBe(18); // top of the 10th
  });

  it('ends the instant the home team takes the lead in the ninth (walk-off)', () => {
    let g = newGame();
    for (let h = 0; h < 17 && !g.final; h++) g = playHalf(g, h === 2 ? 1 : 0);
    expect(g.halfIndex).toBe(17); // bottom of the 9th, away up 1-0
    expect(g.score).toEqual({ away: 1, home: 0 });

    g = applyPitchToGame(g, homer); // 1-1, game continues
    expect(g.final).toBe(false);
    g = applyPitchToGame(g, homer); // 2-1, walk-off
    expect(g.final).toBe(true);
    expect(g.winner).toBe('home');
  });

  it('ignores pitches once final', () => {
    let g = newGame();
    for (let h = 0; h < 18 && !g.final; h++) g = playHalf(g, h === 0 ? 1 : 0);
    const frozen = g;
    expect(applyPitchToGame(g, homer)).toBe(frozen);
  });
});

describe('lineScoreByInning', () => {
  it('splits runs into away and home rows', () => {
    let g = newGame();
    g = playHalf(g, 2); // top 1: away 2
    g = playHalf(g, 0); // bottom 1
    g = playHalf(g, 1); // top 2: away 1
    const line = lineScoreByInning(g);
    expect(line.away).toEqual([2, 1]);
    expect(line.home).toEqual([0]);
  });
});

describe('random games always finish', () => {
  function rng(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const bag: PitchOutcome[] = [
    out,
    out,
    out,
    { kind: 'in-play', play: { hit: true, bases: 1, label: 'single' } },
    { kind: 'in-play', play: { hit: true, bases: 2, label: 'double' } },
    homer,
    { kind: 'ball' },
    { kind: 'swinging-strike' },
    { kind: 'foul' },
  ];

  it('finalises within a sane pitch count and never ties at the end', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rand = rng(seed);
      let g = newGame();
      let pitches = 0;
      while (!g.final) {
        g = applyPitchToGame(g, bag[Math.floor(rand() * bag.length)]);
        if (++pitches > 5000) break;
      }
      expect(g.final).toBe(true);
      expect(g.winner).not.toBeNull();
      expect(g.score.away).not.toBe(g.score.home);
    }
  });
});
