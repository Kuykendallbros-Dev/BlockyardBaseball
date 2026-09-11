/**
 * Matchmaking rating — the one piece of Phase 5 (online multiplayer) that
 * needs no server to be useful or testable; the rest is blocked on a hosting
 * decision (see the Winslow queue). A standard Elo update, used to bucket
 * matchmaking by team rating — the pay-to-win mitigation (see the roadmap's
 * standing decisions).
 */

const K_FACTOR = 32;

export const DEFAULT_RATING = 1000;

export interface RatingUpdate {
  a: number;
  b: number;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** New ratings for both sides after a match. `aWon` — true if side `a` won. */
export function updateRatings(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): RatingUpdate {
  const expectedA = expectedScore(ratingA, ratingB);
  const scoreA = aWon ? 1 : 0;
  const delta = K_FACTOR * (scoreA - expectedA);
  return {
    a: Math.round(ratingA + delta),
    b: Math.round(ratingB - delta),
  };
}
