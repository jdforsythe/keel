import type { HarnessGauge } from "./HarnessGauge.ts";

/** The gauge of each `simulate` run, keyed by its clock (which its replicas share). */
export const harnessGauges = new WeakMap<object, HarnessGauge>();
