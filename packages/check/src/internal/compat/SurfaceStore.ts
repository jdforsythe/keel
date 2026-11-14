/** One store of `surface.json` (k.compat Surface): its state schema and each transaction's payload schema (JSON Schema). */
export type SurfaceStore = {
  readonly id: string;
  readonly state: unknown;
  readonly transactions: ReadonlyMap<string, unknown>;
};
