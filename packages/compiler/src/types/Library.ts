/**
 * One library an app reads (k.library In an app). `name` is its package name, `dir` the real path of the folder holding
 * its `package.json`, `kind` as `libraryKind` reads it, `id` its root manifest's `id` (undefined without a literal
 * one), `manifest` that manifest's source, and `files` the real paths of the files under its `src/` and `unsafe/`,
 * sorted.
 */
export type Library = {
  readonly name: string;
  readonly dir: string;
  readonly kind: "library" | "std";
  readonly id: string | undefined;
  readonly manifest: string | undefined;
  readonly files: readonly string[];
};
