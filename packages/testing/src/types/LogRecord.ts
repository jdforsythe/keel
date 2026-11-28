/**
 * One record of a built server's log as `KEEL_FORMAT=json` writes it (docs/OUTPUT.md Server log): a request, a
 * diagnostic, a policy violation, the listen line, or `other` for a line that is not one of these (its text kept).
 */
export type LogRecord =
  | {
      readonly kind: "req";
      readonly method: string;
      readonly path: string;
      readonly route?: string;
      readonly status: number;
      readonly ms: number;
    }
  | {
      readonly kind: "diag";
      readonly code: string;
      readonly message: string;
      readonly see?: string;
      readonly frames?: readonly string[];
    }
  | {
      readonly kind: "csp";
      readonly directive?: string;
      readonly blocked?: string;
      readonly route?: string;
      readonly dropped?: number;
    }
  | { readonly kind: "summary"; readonly name: string; readonly port?: number }
  | { readonly kind: "other"; readonly text: string };
