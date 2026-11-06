import type { Entry } from "./Entry.ts";

/** What the module pass reads from one file: import specifiers, href() route ids, declared ids, ctx capabilities. */
export type FileFacts = {
  /** Import, re-export, and literal dynamic-import specifiers; `start` is the statement or call. */
  readonly imports: readonly Entry[];
  /** Literal route ids passed to `href()` from `@keel/router`. */
  readonly hrefs: readonly Entry[];
  /** Route ids declared as keys of `manifest({...})` from `@keel/router`. */
  readonly routes: readonly Entry[];
  /** Store ids, transaction names, and error codes declared in the file. */
  readonly ids: readonly (Entry & { readonly kind: "store id" | "transaction name" | "error code" })[];
  /** `ctx.<cap>` member accesses and `const { cap } = ctx` destructurings, one entry per access. */
  readonly ctx: readonly Entry[];
};
