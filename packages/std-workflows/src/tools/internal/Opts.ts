import type { propOf } from "@keel/std-jobs/tools";

/** An expression of the AST, as `propOf` reads it. */
export type Opts = Parameters<typeof propOf>[0];
