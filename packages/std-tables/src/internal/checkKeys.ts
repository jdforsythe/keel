import { defect } from "@keel/schema";
import { ID_SAFE } from "./ID_SAFE.ts";

/** Throws E2853 for a key that repeats or is not id-safe, before any key reaches an element id. */
export function checkKeys(keys: readonly unknown[]): void {
  const seen = new Set<string>();
  for (const k of keys) {
    const key = String(k);
    if (!ID_SAFE.test(key))
      defect("a row key is not 1-64 of A-Z a-z 0-9 _ -", { code: "E2853", data: { key: key.slice(0, 80) } });
    if (seen.has(key)) defect("a row key repeats", { code: "E2853", data: { key } });
    seen.add(key);
  }
}
