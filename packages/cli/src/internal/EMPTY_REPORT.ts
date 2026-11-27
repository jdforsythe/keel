import type { TestReport } from "@keel/testing";

/** A run that ran no test. */
export const EMPTY_REPORT: TestReport = { diagnostics: [], tests: 0, failed: 0, skipped: 0, errors: 0 };
