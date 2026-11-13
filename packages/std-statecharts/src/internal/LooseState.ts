import type { StateSpec } from "../StateSpec.ts";

/** A declared state with its names widened to `string`: what the runtime reads. */
export type LooseState = StateSpec<string, string, string, string>;
