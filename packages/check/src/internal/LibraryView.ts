import type { SourceFile } from "../types/SourceFile.ts";

/**
 * How `check()` reads the library files it is given (k.library In an app). A library file is a file under `src/` or
 * `unsafe/` of `<p>node_modules/<name>/`, `<name>` a package whose `package.json` and root `module.ts` are among the
 * files and make it a library. `view` gives the path every rule reads such a file at, `<p>modules/<id>/<f>`, and any
 * other path unchanged; `real` undoes it. `folder` is the package folder (`<p>node_modules/<name>/`) holding a library
 * file, undefined for any other path. `packages` holds each library's `package.json` among the files;
 * `entries` maps each specifier a library's `exports` gives a source under `src/` or `unsafe/` (`@acme/charts`,
 * `@acme/charts/x`), at its `keel` condition, else at the target Node imports (a string, or `node`, `import` or
 * `default`), to that file's view path; a `*` pattern gives none. `contracts` maps each library's view folder
 * (`<p>modules/<id>/`) to the view path of its `./contract` entry's file, `""` when it declares none (k.contract).
 */
export type LibraryView = {
  readonly view: (path: string) => string;
  readonly real: (path: string) => string;
  readonly folder: (path: string) => string | undefined;
  readonly packages: readonly SourceFile[];
  readonly entries: ReadonlyMap<string, string>;
  readonly contracts: ReadonlyMap<string, string>;
};
