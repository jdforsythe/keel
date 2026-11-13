import type { NumRef } from "./NumRef.ts";
import type { PropRun } from "./PropRun.ts";

/**
 * What one executed body uses: export names it references in code (an imported binding, a member of a namespace
 * import, or a call/`new`/JSX tag by name), identifiers it calls (helpers to follow), property runs (`properties`,
 * `simulate`, fast-check), `explore` calls (closed form or not, and the `depth` as written), and whether it asserts
 * types (`expectTypeOf`, `assertType`).
 */
export type Use = {
  readonly names: ReadonlySet<string>;
  readonly calls: ReadonlySet<string>;
  readonly props: readonly PropRun[];
  readonly explores: readonly { readonly closed: boolean; readonly depth: NumRef }[];
  readonly typed: boolean;
};
