import type { Diagnostic } from "../types/Diagnostic.ts";
import type { FormatSite } from "./FormatSite.ts";
import type { Probe } from "./Probe.ts";

/**
 * One kept type pass (k.check-cache Entries): the key it was kept under, the file system questions it asked with their answers, its findings in
 * order (diagnostics, and the `formatLiteral` calls judged on every run) and per file path the offsets of the
 * expressions typed `Date` that E1758 reads.
 */
export type TypeEntry = {
  readonly key: string;
  readonly probes: readonly Probe[];
  readonly items: readonly (Diagnostic | FormatSite)[];
  readonly dates: ReadonlyMap<string, ReadonlySet<number>>;
  /** Per file path, the offsets of the elements and calls the checker resolves to `@keel/ui`'s `SchemeSelect` (E1814). */
  readonly schemeSelects: ReadonlyMap<string, ReadonlySet<number>>;
};
