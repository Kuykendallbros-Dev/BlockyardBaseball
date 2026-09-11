/**
 * Coins — the soft currency (Phase 3's essential path). `payoutFor` scores a
 * finished game into a coin reward; `createWallet` is an in-memory running
 * balance. No save/load yet — persistence rides along with the accounts
 * backlog item, not this one.
 */

import type { GameState } from './game.ts';
import type { BattingSide } from './scoreboard.ts';

const BASE_PAYOUT = 50;
const RUN_BONUS = 10;
const WIN_BONUS = 100;

/** Coins earned from one finished game, from `humanSide`'s perspective. */
export function payoutFor(game: GameState, humanSide: BattingSide): number {
  if (!game.final) return 0;
  const runs = humanSide === 'home' ? game.score.home : game.score.away;
  const won = game.winner === humanSide;
  return BASE_PAYOUT + runs * RUN_BONUS + (won ? WIN_BONUS : 0);
}

export interface Wallet {
  balance: () => number;
  credit: (coins: number) => void;
  /** Debits and returns true if affordable; otherwise a no-op that returns false. */
  spend: (coins: number) => boolean;
}

export function createWallet(startingBalance = 0): Wallet {
  let balance = Math.max(0, startingBalance);
  return {
    balance: () => balance,
    credit: (coins) => {
      balance += Math.max(0, coins);
    },
    spend: (coins) => {
      if (coins < 0 || coins > balance) return false;
      balance -= coins;
      return true;
    },
  };
}
