import type { Ctx } from "@keel/ctx";

/** The ctxs a `simulate` run owns, each with the step that advances its sim clock to the next deadline in the horizon. */
export const simClocks = new WeakMap<Ctx, () => boolean>();
