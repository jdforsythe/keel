import type { Ctx } from "../Ctx.ts";
import type { Mode } from "../Mode.ts";

/** Builds one registered capability for a ctx under construction and records it for the accessor. */
export type Attach = (target: Ctx, mode: Mode, seed: number) => void;
