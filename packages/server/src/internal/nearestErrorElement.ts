import type { Level } from "@keel/router/internal";

/** Nearest chain index at or above `from` whose route has an `errorElement`; -1 when none. */
export function nearestErrorElement(chain: readonly Level[], from: number): number {
  for (let i = Math.min(from, chain.length - 1); i >= 0; i--) if (chain[i]?.def.errorElement !== undefined) return i;
  return -1;
}
