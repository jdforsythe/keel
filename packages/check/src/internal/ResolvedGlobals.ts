import type { Expression } from "oxc-parser";
import type { Ref } from "./Ref.ts";

/**
 * Global-name resolution of one file (rfc:0053): which reads are the global they spell, through aliases,
 * literal keys and destructuring, with names bound by lexical scope.
 */
export type ResolvedGlobals = {
  /** Identifier reads of the file, sorted by start (as `references`). */
  readonly refs: readonly Ref[];
  /** Names bound by `export` declarations, at their identifier; `destructured` when bound by a pattern. */
  readonly exported: readonly { readonly name: string; readonly at: number; readonly destructured: boolean }[];
  /** The global path `e` denotes (`globalThis`/`window`/`self` prefix dropped), or null: local or not static. */
  readonly resolve: (e: Expression) => string[] | null;
  /** The global path of the name `name` read at offset `at`, or null when a local binding is not an alias. */
  readonly resolveName: (name: string, at: number) => string[] | null;
  /** Whether the span `start..end` is the initializer of an unexported alias (reported at its uses instead). */
  readonly isAliasInit: (start: number, end: number) => boolean;
};
