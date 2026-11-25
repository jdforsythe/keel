import type { propOf } from "./propOf.ts";

/** An expression of the AST, as `propOf` reads it. */
export type Opts = Parameters<typeof propOf>[0];
