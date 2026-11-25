import type { SourceFile } from "../types/SourceFile.ts";

/**
 * A package whose source `keel check` resolves to (k.privacy-reads Factories): the file a specifier names and every
 * code file of the package, each at `<name>/<path in the package>`, read as the reader reads project files.
 */
export type ReadPackage = { readonly entry: SourceFile; readonly files: readonly SourceFile[] };
