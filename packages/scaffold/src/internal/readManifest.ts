import type { Manifest } from "./Manifest.ts";
import { manifestArrays } from "./manifestArrays.ts";
import { parseSource } from "./parseSource.ts";
import { stringItems } from "./stringItems.ts";

/** Read a `module.ts` manifest; null when it does not parse or has no `module({...})` call. */
export function readManifest(path: string, src: string): Manifest | null {
  const program = parseSource(path, src);
  const a = program === null ? null : manifestArrays(program);
  if (a === null) return null;
  return {
    id: a.id,
    deps: a.deps === null ? [] : stringItems(a.deps),
    exports: a.exports === null ? [] : stringItems(a.exports),
    env: a.env === null ? [] : stringItems(a.env),
  };
}
