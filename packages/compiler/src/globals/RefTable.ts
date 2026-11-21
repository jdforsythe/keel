import type { Ref } from "./Ref.ts";

/** Identifier reads of a file (sorted by start) and every name the file declares anywhere. */
export type RefTable = { readonly refs: readonly Ref[]; readonly declared: ReadonlySet<string> };
