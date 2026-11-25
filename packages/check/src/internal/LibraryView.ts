import type { SourceFile } from "../types/SourceFile.ts";

/**
 * How `check()` reads the library files it is given (k.library In an app). A library file is a file under `src/` or
 * `unsafe/` of `<p>node_modules/<name>/`, `<name>` a package whose `package.json` and root `module.ts` are among the
 * files and make it a library. `view` gives the path every rule reads such a file at, `<p>modules/<id>/<f>`, and any
 * other path unchanged; `real` undoes it. `folder` is the package folder (`<p>node_modules/<name>/`) holding a library
 * file, undefined for any other path. `packages` holds each library's `package.json` among the files.
 */
export type LibraryView = {
  readonly view: (path: string) => string;
  readonly real: (path: string) => string;
  readonly folder: (path: string) => string | undefined;
  readonly packages: readonly SourceFile[];
};
