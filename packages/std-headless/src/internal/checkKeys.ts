import { defect } from "@keel/schema";

const KEY = /^[\w-]{1,64}$/;

/** Throws E2801 for a key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in the widget `id`. */
export function checkKeys(id: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    const problem = !KEY.test(key) ? "is not 1 to 64 of [A-Za-z0-9_-]" : seen.has(key) ? "repeats" : undefined;
    if (problem !== undefined)
      defect("a widget key is not 1 to 64 of [A-Za-z0-9_-] or repeats", "E2801", { data: { id, key, problem } });
    seen.add(key);
  }
}
