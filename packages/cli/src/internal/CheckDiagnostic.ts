/** The structural shape the cli reads from a `@keel/check` diagnostic (k.check Diagnostics). */
export type CheckDiagnostic = {
  readonly code: string;
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly col?: number | undefined;
  readonly message: string;
  readonly fix?: string | undefined;
  readonly see?: string | undefined;
};
