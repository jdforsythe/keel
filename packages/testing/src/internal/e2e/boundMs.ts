import type { Wait } from "../../types/Wait.ts";
import { timeScale } from "./timeScale.ts";

/** The default bound of a wait (k.e2e-page Waits): the machine's own work, a render or a response, so fixed time. */
const DEFAULT = 10_000;

/**
 * A wait's bound in ms (k.e2e Time): `within`, a time the test chose, times `KEEL_TEST_TIME_SCALE`, plus `fixed`, the
 * app's own time, unscaled; with neither, the 10 s default, unscaled (docs/TESTING.md Time scale).
 */
export function boundMs(wait: Wait = {}, scale = timeScale()): number {
  if (wait.within === undefined && wait.fixed === undefined) return DEFAULT;
  return Math.max(1, Math.round((wait.within ?? 0) * scale + (wait.fixed ?? 0)));
}
