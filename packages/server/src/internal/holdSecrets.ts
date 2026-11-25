import { SCRUB_CAP } from "./SCRUB_CAP.ts";
import { holdValues } from "./holdValues.ts";

/**
 * Adds the empty string, which matches nothing, and each of `values` to `into`, a scope's secret set (`holdValues`):
 * the set then holds a value whenever the scope made or revealed a secret, so past the cap its texts are marked
 * `[secret]`. `cap` is for tests.
 */
export function holdSecrets(into: Set<string>, values: readonly string[], cap: number = SCRUB_CAP): void {
  into.add("");
  holdValues(into, values, cap);
}
