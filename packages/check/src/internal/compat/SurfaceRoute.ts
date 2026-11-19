/** A JSON Schema node of `surface.json`, or `null` where the route or endpoint declares none. */
type Js = unknown;

/** One route of `surface.json` (k.compat Surface): GET answer and per-method action input and answer. */
export type SurfaceRoute = {
  readonly id: string;
  readonly module: string;
  readonly path: string;
  /** The routes manifest declaring it, project-relative. */
  readonly file: string;
  readonly params: Js;
  readonly search: Js;
  readonly get: Js;
  readonly actions: ReadonlyMap<string, { readonly input: Js; readonly answer: Js }>;
};
