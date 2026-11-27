import type { SourceFile } from "../types/SourceFile.ts";

/**
 * What `check()` records of the libraries in each project array it hands the rules (k.library In an app): `entries`,
 * each library specifier to the view path of the source its `exports` give, `files`, the view paths of the
 * libraries' files, and `real`, a view path's path in the project. `isClientReachable` and `isBrowserFile` read it, so a library's file reached from the app's client
 * code is judged as a module file the client reaches.
 */
export const projectLibraries = new WeakMap<
  readonly SourceFile[],
  {
    readonly entries: ReadonlyMap<string, string>;
    readonly files: ReadonlySet<string>;
    readonly real: (view: string) => string;
  }
>();
