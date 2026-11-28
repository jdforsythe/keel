import type { Argument } from "oxc-parser";
import type { Entry } from "./Entry.ts";

/** What the module pass reads from one file: import specifiers, declared ids, store schemas, ctx capabilities. */
export type FileFacts = {
  /** Import, re-export, and literal dynamic-import specifiers; `start` is the statement or call. */
  readonly imports: readonly Entry[];
  /** Store ids, transaction names, and error codes declared in the file. */
  readonly ids: readonly (Entry & { readonly kind: "store id" | "transaction name" | "error code" })[];
  /** The state schema argument of each `store(...)` call from `@keel/store`. */
  readonly stores: readonly Argument[];
  /** `ctx.<cap>` member accesses, `const { cap } = ctx` destructurings and `observe(...)` calls (`observe`), one entry per use. */
  readonly ctx: readonly Entry[];
};
