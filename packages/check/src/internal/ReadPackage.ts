import type { SourceFile } from "../types/SourceFile.ts";

/**
 * A package whose source `keel check` resolves to (k.privacy-reads Factories): the file a specifier names and every
 * code file of the package, each at its real path on disk (two copies of one package stay apart), read as the reader
 * reads project files; or a library the app lists, read among the project's files, `entries` its libraries' `exports`
 * entries to the files they give (k.library In an app).
 */
export type ReadPackage = {
  readonly entry: SourceFile;
  readonly files: readonly SourceFile[];
  readonly entries?: ReadonlyMap<string, string>;
};
