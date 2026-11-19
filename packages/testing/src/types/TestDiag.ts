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
};
