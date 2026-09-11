import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { createWallet, payoutFor } from './wallet.ts';

function finishedGame(overrides: Partial<GameState>): GameState {
  return {
    halfIndex: 17,
    half: {
      balls: 0,
      strikes: 0,
      outs: 3,
      bases: [false, false, false],
      runs: 0,
      over: true,
      lastEvent: 'side retired',
    },
    score: { away: 2, home: 5 },
    lineScore: [],
    final: true,
    winner: 'home',
    ...overrides,
  };
}

describe('payoutFor', () => {
  it('pays nothing for an unfinished game', () => {
    expect(payoutFor(finishedGame({ final: false }), 'home')).toBe(0);
  });

  it('pays a base amount plus a per-run bonus for the human side', () => {
    const game = finishedGame({ score: { away: 5, home: 3 }, winner: 'away' });
    // human (home) lost, scored 3 runs: base + 3 * run bonus, no win bonus
    expect(payoutFor(game, 'home')).toBe(50 + 3 * 10);
  });

  it('adds a win bonus when the human side wins', () => {
    const lost = finishedGame({ score: { away: 5, home: 3 }, winner: 'away' });
    const won = finishedGame({ score: { away: 3, home: 5 }, winner: 'home' });
    expect(payoutFor(won, 'home')).toBeGreaterThan(payoutFor(lost, 'home'));
  });
});

describe('createWallet', () => {
  it('starts at the given balance, floored at 0', () => {
    expect(createWallet(100).balance()).toBe(100);
    expect(createWallet(-50).balance()).toBe(0);
  });

  it('credits add to the balance', () => {
    const wallet = createWallet(0);
    wallet.credit(50);
    wallet.credit(25);
    expect(wallet.balance()).toBe(75);
  });

  it('spend succeeds and debits when affordable', () => {
    const wallet = createWallet(100);
    expect(wallet.spend(60)).toBe(true);
    expect(wallet.balance()).toBe(40);
  });

  it('spend fails and leaves the balance untouched when not affordable', () => {
    const wallet = createWallet(50);
    expect(wallet.spend(60)).toBe(false);
    expect(wallet.balance()).toBe(50);
  });
});
