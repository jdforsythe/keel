import type { Wait } from "../../types/Wait.ts";
import { timeScale } from "./timeScale.ts";

/** The default bound of a wait the test chose (k.e2e-page Waits), before the scale. */
const DEFAULT = 10_000;

/**
 * A wait's bound in ms (k.e2e Time): `within` (10 s when neither part is given, none when only `fixed` is) times
 * `KEEL_TEST_TIME_SCALE`, plus `fixed` unscaled.
 */
export function boundMs(wait: Wait = {}, scale = timeScale()): number {
  const within = wait.within ?? (wait.fixed === undefined ? DEFAULT : 0);
  return Math.max(1, Math.round(within * scale + (wait.fixed ?? 0)));
}
