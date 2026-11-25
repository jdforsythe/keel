/**
 * A run report (k.test-run Run report): per test file the run collected, its path relative to the project, the
 * SHA-256 hex of its source and, per test case run or skipped, its 1-based location line and state, ordered by line.
 */
export type TestRunReport = {
  readonly v: 1;
  readonly files: Readonly<
    Record<
      string,
      {
        readonly sha: string;
        readonly tests: readonly { readonly line: number; readonly state: "passed" | "failed" | "skipped" }[];
      }
    >
  >;
};
