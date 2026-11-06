/** One failed test or run error as an OUTPUT.md diagnostic (T0001), relative path, app frames only. */
export type TestDiag = {
  readonly kind: "diag";
  readonly code: "T0001";
  readonly path?: string;
  readonly line?: number;
  readonly col?: number;
  readonly message: string;
  readonly fix?: string;
};
