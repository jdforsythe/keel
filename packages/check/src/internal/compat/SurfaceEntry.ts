/** One API entry of a contract in `surface.json` (k.compat Surface): its id, method, path and JSON Schemas. */
export type SurfaceEntry = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly params: unknown;
  readonly query: unknown;
  readonly body: unknown;
  readonly output: unknown;
  readonly errors: ReadonlyMap<string, unknown>;
};
