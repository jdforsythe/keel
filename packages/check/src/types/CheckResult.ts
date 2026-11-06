import type { Diagnostic } from "./Diagnostic.ts";
import type { Summary } from "./Summary.ts";

/** Result of `check`: deduplicated diagnostics sorted by path, line, col, code; and their summary. */
export type CheckResult = { readonly diagnostics: readonly Diagnostic[]; readonly summary: Summary };
