/** A diagnostic as docs/OUTPUT.md prints it; `path` relative to the working folder, absent for none. */
export type OutDiag = {
  readonly kind: "diag";
  readonly code: string;
  readonly path?: string;
  readonly line?: number;
  readonly col?: number;
  readonly message: string;
  readonly see: string;
};
