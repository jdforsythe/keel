import type { Diag } from "./Diag.ts";

/** What a vitest run produced, in OUTPUT.md terms. */
export type TestTally = { diags: Diag[]; tests: number; failed: number; skipped: number };
