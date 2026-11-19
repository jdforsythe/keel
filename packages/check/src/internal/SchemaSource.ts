import type { Expression } from "oxc-parser";

/**
 * One file as schema resolution reads it: its path, the local names of `s` from `@keel/schema`, its top-level
 * `const` initializers, and its named imports by local name.
 */
export type SchemaSource = {
  readonly path: string;
  readonly s: ReadonlySet<string>;
  readonly consts: ReadonlyMap<string, Expression>;
  readonly imports: ReadonlyMap<string, { readonly source: string; readonly name: string }>;
};
