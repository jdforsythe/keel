/** A `module.ts` by its name, any code extension. */
const MANIFEST = /(?:^|\/)module\.[cm]?[jt]sx?$/;
/** A `module.ts` deeper than `modules/<id>/module.ts` of an app. */
const DEEPER = /(?:^|\/)modules\/[^/]+\/(?:[^/]+\/)+module\.[cm]?[jt]sx?$/;

/**
 * Whether `path` is a `module.ts` that is no manifest (k.module E1171): in an app, one deeper than
 * `modules/<id>/module.ts`; in a library (`library`: the path is one of a library's `src/` or `unsafe/` files), any.
 */
export function strayManifest(path: string, library: boolean): boolean {
  if (!MANIFEST.test(path)) return false;
  return library || (!path.includes("node_modules/") && DEEPER.test(path));
}
