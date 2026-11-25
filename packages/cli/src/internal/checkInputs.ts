import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import { libraryProjectFiles } from "./libraryProjectFiles.ts";

/**
 * What `runCheck` hands `check()` (k.library In an app): `all`, `project` with the files of the libraries its manifests
 * reach (`libraryProjectFiles`, the one read of them, each path once and none `project` already holds), and `checked`,
 * `files` with those libraries' code files when `libraries` is set.
 */
export function checkInputs(
  cwd: string,
  files: readonly SourceFile[],
  project: readonly SourceFile[],
  libraries: boolean,
): { readonly all: readonly SourceFile[]; readonly checked: readonly SourceFile[] } {
  const libs = libraryProjectFiles(cwd, project);
  const have = new Set(files.map((f) => f.path));
  const code = libs.filter((f) => CODE_FILE.test(f.path) && !have.has(f.path));
  return {
    all: libs.length === 0 ? project : [...project, ...libs],
    checked: libraries && code.length > 0 ? [...files, ...code] : files,
  };
}
