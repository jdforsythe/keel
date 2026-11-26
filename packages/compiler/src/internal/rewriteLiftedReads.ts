import path from "node:path";
import { type HeldLibrary, libraryOf } from "./libraryOf.ts";
import { liftedRead } from "./liftedRead.ts";
import { packageFolder } from "./packageFolder.ts";
import { urlCalls } from "./urlCalls.ts";

/**
 * A server bundle's rewrite of a bundled package file (k.server-deps Files a bundled package reads): each literal first
 * argument of `new URL(<a>, import.meta.url)` naming a path above the file's folder and inside its package's folder
 * becomes `./` and the path `keel build` copies it to (`liftedRead`). Null when `id` is no bundled package file or
 * holds no such read; no other text changes.
 */
export function rewriteLiftedReads(id: string, code: string, libraries: readonly HeldLibrary[]): string | null {
  if (!path.isAbsolute(id) || !code.includes("import.meta.url")) return null;
  const lib = libraryOf(libraries, id);
  if (lib === undefined && !id.split(path.sep).includes("node_modules")) return null;
  const folder = packageFolder(id, lib);
  const edits: { start: number; end: number; text: string }[] = [];
  for (const call of urlCalls(id, code)) {
    const lifted = call.first === undefined || call.name === undefined ? undefined : liftedRead(id, call.name, folder);
    if (call.first !== undefined && lifted !== undefined)
      edits.push({ start: call.first.start, end: call.first.end, text: JSON.stringify(`./${lifted}`) });
  }
  if (edits.length === 0) return null;
  let out = code;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
