import { normClause } from "./normClause.ts";

/**
 * The bullet nearest a quote (k.ledger-items Rules, E1732): the one whose normal form shares the most distinct words
 * with the quote's, the first on a tie; `undefined` with no bullet.
 */
export function nearestClause<T extends { readonly text: string }>(
  quote: string,
  bullets: readonly T[],
): T | undefined {
  const words = new Set(normClause(quote).split(" "));
  let best: T | undefined;
  let most = -1;
  for (const b of bullets) {
    const shared = new Set(
      normClause(b.text)
        .split(" ")
        .filter((w) => words.has(w)),
    ).size;
    if (shared > most) {
      best = b;
      most = shared;
    }
  }
  return best;
}
