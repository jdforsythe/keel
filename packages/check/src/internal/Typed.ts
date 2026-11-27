import type { Diagnostic } from "../types/Diagnostic.ts";

/** The type pass's diagnostics, and per file path the offsets of the expressions typed `Date` that E1758 reads. */
export type Typed = {
  readonly diagnostics: Diagnostic[];
  readonly dates: ReadonlyMap<string, ReadonlySet<number>>;
  /** Per file path, the offsets of what the checker resolves to `@keel/ui`'s `SchemeSelect` (E1814). */
  readonly schemeSelects: ReadonlyMap<string, ReadonlySet<number>>;
};
