import { looksDiags } from "./internal/looks/looksDiags.ts";
import { looksOf } from "./internal/looks/looksOf.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * The E1815 diagnostics of the project at the root of `files` (k.looks Entries), judged from the libraries'
 * `package.json` text before anything is evaluated: the cli evaluates no `tokens.ts` while one stands.
 */
export function libraryEntryDiags(files: readonly SourceFile[]): Diagnostic[] {
  return looksDiags(looksOf(files, ""), files, { given: false, value: undefined }).filter((d) => d.code === "E1815");
}
