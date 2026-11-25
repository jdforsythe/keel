import { countHosts } from "./internal/countHosts.ts";
import { scrubCode } from "./internal/scrubCode.ts";

/** `unsafe(...)` and `unsafe<T>(...)` calls; the declaration `function unsafe<T>(` is not a use. */
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*\(/g;

/**
 * The ledger's counts over one code file (k.ledger File, k.host-element Ledger): its `unsafe(...)` calls outside
 * comments and strings, and its host elements (`<Host>` elements and `Host(...)` calls of `@keel/ui`'s `Host`). The one
 * count `keel ledger` writes and E1162 compares a library's ledger file with.
 */
export function ledgerCount(path: string, source: string): { unsafe: number; hostElements: number } {
  const unsafe = scrubCode(source).reduce((n, l) => n + (l.match(UNSAFE_CALL) ?? []).length, 0);
  return { unsafe, hostElements: countHosts(path, source) };
}
