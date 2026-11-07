import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { Entry } from "./Entry.ts";
import { inNodeModules } from "./inNodeModules.ts";

const QUOTES = new Set(["'", '"', "`"]);

/**
 * E1155 fix (unified diff of `file`): the declared id at `entry` becomes `<prefix>.<id>`, keeping a string literal's
 * quote; an identifier key (`show: {...}`) becomes a quoted key. `undefined` under `node_modules/`.
 */
export function prefixFix(file: SourceFile, entry: Entry, prefix: string): string | undefined {
  if (inNodeModules(file.path)) return undefined;
  const open = file.source[entry.start] ?? "";
  const q = QUOTES.has(open) ? open : "'";
  const edit = { start: entry.start, end: entry.end, text: `${q}${prefix}.${entry.value}${q}` };
  const fix = unifiedDiff(file.path, file.source, applyEdits(file.source, [edit]));
  return fix === "" ? undefined : fix;
}
