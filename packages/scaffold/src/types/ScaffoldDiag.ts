/** One diagnostic in the OUTPUT.md shape. `cause` is the diagnostic an aborted edit set would introduce (E1353). */
export type ScaffoldDiag = {
  readonly kind: "diag";
  readonly code: string;
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
  readonly see: "k.scaffold" | "k.scaffold-service" | "k.scaffold-shell";
  readonly cause?: { readonly code: string; readonly path: string; readonly line: number; readonly message: string };
};
