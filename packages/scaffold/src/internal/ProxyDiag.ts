/** A diagnostic of the cheap check proxy (verify.ts). */
export type ProxyDiag = {
  readonly code: string;
  readonly path: string;
  readonly line: number;
  readonly message: string;
};
