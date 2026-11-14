import type { Opts } from "./Opts.ts";

/**
 * One `workflow(id, opts)` call: the file holding it, its options literal, and where its chart is declared: a `const`
 * named `name` in the file at `path`, or the `chart` call at offset `start` there.
 */
export type Flow = {
  readonly path: string;
  readonly opts: Opts;
  readonly chart: { readonly path: string; readonly name?: string; readonly start?: number };
};
