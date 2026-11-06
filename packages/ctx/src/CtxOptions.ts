import type { Mode } from "./Mode.ts";

/** Options for createCtx. `mode` defaults to sim under KEEL_TEST=1, else real. `seed` (default 0) drives sim. */
export interface CtxOptions {
  readonly mode?: Mode;
  readonly seed?: number;
}
