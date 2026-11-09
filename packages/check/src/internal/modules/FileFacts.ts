import type { Entry } from "./Entry.ts";

/** What the module pass reads from one file: import specifiers, href() route ids, declared ids, ctx capabilities. */
export type FileFacts = {
  /** Import, re-export, and literal dynamic-import specifiers; `start` is the statement or call. */
  readonly imports: readonly Entry[];
  /** Literal route ids passed to `href()` from `@keel/router` or to a member `<x>.href('id')` (rfc:0041). */
  readonly hrefs: readonly Entry[];
  /** Route ids declared as keys of `manifest({...})` from `@keel/router`. */
  readonly routes: readonly Entry[];
  /** Store ids, transaction names, and error codes declared in the file. */
  readonly ids: readonly (Entry & { readonly kind: "store id" | "transaction name" | "error code" })[];
  /** `ctx.<cap>` member accesses, `const { cap } = ctx` destructurings and `observe(...)` calls (`observe`), one entry per use. */
  readonly ctx: readonly Entry[];
};
