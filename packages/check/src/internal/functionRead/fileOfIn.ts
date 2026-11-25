import type { SourceFile } from "../../types/SourceFile.ts";
import { importTarget } from "../importTarget.ts";
import type { FileOf } from "./FileOf.ts";

/**
 * The `FileOf` over `files`: a specifier `entries` holds (a library's `exports` entry, k.library In an app) to the file
 * at the path it gives, any other relative one as `importTarget` finds it.
 */
export function fileOfIn(files: readonly SourceFile[], entries: ReadonlyMap<string, string> = new Map()): FileOf {
  const byPath = new Map(files.map((f) => [f.path, f]));
  return (from, spec) => {
    const at = entries.get(spec);
    return at !== undefined ? byPath.get(at) : importTarget(from.path, spec, files);
  };
}
