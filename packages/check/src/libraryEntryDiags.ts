import { looksDiags } from "./internal/looks/looksDiags.ts";
import { looksOf } from "./internal/looks/looksOf.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * The E1815 and E1812 diagnostics of the project at the root of `files` (k.entries, k.looks Shipped tokens), judged
 * from the libraries' `package.json` and shipped tokens files as text before anything is evaluated: the cli
 * evaluates and bundles nothing of the project while one stands.
 */
export function libraryEntryDiags(files: readonly SourceFile[]): Diagnostic[] {
  return looksDiags(looksOf(files, ""), files, { given: false, value: undefined }).filter(
    (d) => d.code === "E1815" || d.code === "E1812",
  );
}
