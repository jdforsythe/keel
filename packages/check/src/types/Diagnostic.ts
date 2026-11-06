/**
 * One diagnostic (docs/OUTPUT.md, k.check): stable code (`E`/`W`/`I` + four digits), 1-based location,
 * one-line message under 90 chars, optional `see` (spec section id) and `fix` (unified diff). Key order is
 * fixed so the json rendering of a passed-through compiler diagnostic is byte-identical.
 */
export type Diagnostic = {
  readonly kind: "diag";
  readonly code: string;
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
  readonly see?: string;
  readonly fix?: string;
};
