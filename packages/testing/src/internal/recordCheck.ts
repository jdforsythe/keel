import { currentTestMeta } from "../../unsafe/currentTestMeta.ts";
import type { A11yCheck } from "./A11yCheck.ts";

/**
 * Append `check` to the running test's `meta.a11y` (vitest hands `meta` to reporters; `keel test` writes it to
 * `reports/a11y.json`). Outside a test (a hook, or no vitest) nothing is kept.
 */
export function recordCheck(check: A11yCheck): void {
  const meta = currentTestMeta();
  if (meta === undefined) return;
  const prior = meta.a11y;
  meta.a11y = [...(Array.isArray(prior) ? prior : []), check];
}
