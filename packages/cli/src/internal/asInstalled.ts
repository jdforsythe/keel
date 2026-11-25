import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

/** A library's own files an app holds installed: its manifest, its code and its tests. */
const OWN = /^(?:module\.ts$|src\/|unsafe\/|test\/)/;

/**
 * The files of a library's own folder as an app holds the library installed (k.library-pack Own folder), so
 * `keel check` there reads it as every app does: `module.ts`, `src/`, `unsafe/` and `test/` under
 * `node_modules/<name>/`, beside its `package.json` (`pkg`, the text); the root `tokens.ts`, the other files that are
 * no code, and `.keel/` stay where they are. Any other code file (a `conformance/` folder, a tool's script or
 * configuration) is no file of the library and is not read. `to` maps a folder path to its place in `files`, `back` a
 * place to the folder path.
 */
export function asInstalled(
  name: string,
  pkg: string,
  files: readonly SourceFile[],
): { readonly files: SourceFile[]; readonly to: (path: string) => string; readonly back: (path: string) => string } {
  const at = `node_modules/${name}/`;
  const to = (p: string): string => (OWN.test(p) || p === "src" || p === "unsafe" || p === "test" ? `${at}${p}` : p);
  const back = (p: string): string => (p.startsWith(at) ? p.slice(at.length) : p);
  const read = (p: string): boolean => OWN.test(p) || p === "tokens.ts" || p.startsWith(".keel/") || !CODE_FILE.test(p);
  return {
    files: [
      { path: `${at}package.json`, source: pkg },
      ...files.filter((f) => read(f.path)).map((f) => ({ path: to(f.path), source: f.source })),
    ],
    to,
    back,
  };
}
