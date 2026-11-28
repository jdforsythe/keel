import type { SourceFile } from "../../types/SourceFile.ts";
import type { Manifest } from "./Manifest.ts";

/**
 * One discovered module. `key` is what `deps` name (the folder id of `modules/<id>/`, or the package name
 * of a library, k.library); `prefix` prefixes its route ids, store ids, transaction names, and error codes; `root` is its
 * folder with a trailing `/`. `manifest` is `null` when the manifest is not a literal object (opaque: not enforced).
 * `library` is true for a library's root manifest under `node_modules/`. `entries` are a package's own `exports` subpaths
 * (`server` of `./server`), each written whole (no `*`), other than `.`: entries, not files, so `public.exports` does not
 * judge them (k.module E1151).
 */
export type ModuleInfo = {
  readonly key: string;
  readonly prefix: string;
  readonly root: string;
  readonly file: SourceFile;
  readonly manifest: Manifest | null;
  readonly library: boolean;
  readonly entries: ReadonlySet<string>;
};
