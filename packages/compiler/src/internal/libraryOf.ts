import path from "node:path";

/** A library the app reads (k.library In an app): its package name and the real path of its folder. */
export type HeldLibrary = { readonly name: string; readonly dir: string };

/** The library among `libraries` whose real folder holds `file`, or undefined. */
export function libraryOf(libraries: readonly HeldLibrary[], file: string): HeldLibrary | undefined {
  return libraries.find((l) => {
    const rel = path.relative(l.dir, file);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}
