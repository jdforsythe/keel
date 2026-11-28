/**
 * One failed test or run error as an OUTPUT.md diagnostic, relative path, app frames only: T0001, or the E17xx code a
 * harness failure carries.
 */
export type TestDiag = {
  readonly kind: "diag";
  readonly code: "T0001" | `E17${string}`;
  readonly path?: string;
  readonly line?: number;
  readonly col?: number;
  readonly message: string;
  readonly fix?: string;
  /** Lines printed below the head: an e2e test's `server:`, `screenshot:` and `trace:` lines (k.e2e-page Failure output). */
  readonly detail?: string;
};
