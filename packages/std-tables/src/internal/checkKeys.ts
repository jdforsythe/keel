import { ID_SAFE } from "./ID_SAFE.ts";

/** Throws E2853 for a key that repeats or is not id-safe, before any key reaches an element id. */
export function checkKeys(keys: readonly unknown[]): void {
  const seen = new Set<string>();
  for (const k of keys) {
    const key = String(k);
    if (!ID_SAFE.test(key)) throw new Error(`E2853 row key ${JSON.stringify(key)} is not 1-64 of A-Z a-z 0-9 _ -`);
    if (seen.has(key)) throw new Error(`E2853 row key ${key} repeats`);
    seen.add(key);
  }
}
