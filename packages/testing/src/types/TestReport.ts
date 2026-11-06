import type { TestDiag } from "./TestDiag.ts";

/** A finished vitest run in OUTPUT.md terms: one diagnostic per failure and the trailer counts. */
export type TestReport = {
  readonly diagnostics: readonly TestDiag[];
  readonly tests: number;
  readonly failed: number;
  readonly skipped: number;
  /** Unhandled errors outside any test. */
  readonly errors: number;
};
