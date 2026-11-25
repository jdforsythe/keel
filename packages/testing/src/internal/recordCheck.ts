import type { A11yCheck } from "./A11yCheck.ts";
import { currentTestMeta } from "./currentTestMeta.ts";

/**
 * Append `check` to the running test's `meta.a11y` (vitest hands `meta` to reporters; `keel test` writes it to
 * `reports/a11y.json`). Outside a test (a hook, or no vitest) nothing is kept.
 */
export function recordCheck(check: A11yCheck): void {
  const meta = currentTestMeta();
  if (meta === undefined) return;
  const prior: unknown = Reflect.get(meta, "a11y");
  Reflect.set(meta, "a11y", [...(Array.isArray(prior) ? prior : []), check]);
}
