import type { SourceFile } from "../../types/SourceFile.ts";
import type { Manifest } from "./Manifest.ts";

/**
 * One discovered module. `key` is what `deps` name (the folder id of `modules/<id>/`, or the stdlib package name
 * `@keel/std-x`); `prefix` prefixes its route ids, store ids, transaction names, and error codes; `root` is its
 * folder with a trailing `/`. `manifest` is `null` when the manifest is not a literal object (opaque: not enforced).
 */
export type ModuleInfo = {
  readonly key: string;
  readonly prefix: string;
  readonly root: string;
  readonly file: SourceFile;
  readonly manifest: Manifest | null;
};
