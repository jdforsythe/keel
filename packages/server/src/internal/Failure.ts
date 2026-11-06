import type { KeelError } from "@keel/schema";

/**
 * An error to render in place of chain level `level` (its `errorElement`; -1: the default alert). `bare`
 * renders it without the layouts above (they have loaders or guards that did not run).
 */
export type Failure = { readonly level: number; readonly bare: boolean; readonly error: KeelError<string, unknown> };
