import type { PropRun } from "./PropRun.ts";

/**
 * What one executed body uses: export names it references in code (an imported binding, a member of a namespace
 * import, or a call/`new`/JSX tag by name), identifiers it calls (helpers to follow), and property runs.
 */
export type Use = {
  readonly names: ReadonlySet<string>;
  readonly calls: ReadonlySet<string>;
  readonly props: readonly PropRun[];
};
