/** A JSON Schema node of `surface.json`, or `null` where the route or endpoint declares none. */
type Js = unknown;

/** One endpoint of a `service({ module })` call. */
export type SurfaceEndpoint = {
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly params: Js;
  readonly query: Js;
  readonly body: Js;
  readonly output: Js;
  readonly errors: ReadonlyMap<string, Js>;
};
