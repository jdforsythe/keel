import type { Edit } from "../../types/Edit.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { Entry } from "./Entry.ts";
import { inNodeModules } from "./inNodeModules.ts";

const QUOTES = new Set(["'", '"', "`"]);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The edits that rename the route id `id` where `file` uses it, other than at `skip`: a quoted `layout` value, a quoted
 * object key, and in `routes.ts` an identifier key (made quoted). `undefined` when the file holds the id quoted in any
 * other place, which a rename in place cannot judge.
 */
function uses(file: SourceFile, id: string, next: string, skip: number | undefined): Edit[] | undefined {
  const edits: Edit[] = [];
  const quoted = new RegExp(`(['"\`])${escaped(id)}\\1`, "g");
  for (const m of file.source.matchAll(quoted)) {
    if (m.index === skip) continue;
    const before = file.source.slice(0, m.index);
    const after = file.source.slice(m.index + m[0].length);
    if (!/^\s*:/.test(after) && !/\blayout\s*:\s*$/.test(before)) return undefined;
    const q = m[1] ?? "'";
    edits.push({ start: m.index, end: m.index + m[0].length, text: `${q}${next}${q}` });
  }
  if (IDENTIFIER.test(id) && /(?:^|\/)routes\.tsx?$/.test(file.path))
    for (const m of file.source.matchAll(new RegExp(`(?<![\\w$.'"\`])${escaped(id)}(?=\\s*:)`, "g")))
      edits.push({ start: m.index, end: m.index + id.length, text: `'${next}'` });
  return edits;
}

/**
 * E1155 fix (unified diff): the declared id at `entry` of `file` becomes `<prefix>.<id>`, keeping a string literal's
 * quote; an identifier key (`show: {...}`) becomes a quoted key. For a route id, each use in `file` and in the module's
 * `others` files (`uses`: a binding key, a `layout` value) is renamed too, and there is no fix when one of them holds
 * the id quoted elsewhere. `undefined` under `node_modules/`.
 */
export function prefixFix(
  file: SourceFile,
  entry: Entry,
  prefix: string,
  route = false,
  others: readonly SourceFile[] = [],
): string | undefined {
  if (inNodeModules(file.path)) return undefined;
  const open = file.source[entry.start] ?? "";
  const q = QUOTES.has(open) ? open : "'";
  const next = `${prefix}.${entry.value}`;
  const edit = { start: entry.start, end: entry.end, text: `${q}${next}${q}` };
  const files: { file: SourceFile; edits: Edit[] }[] = [];
  if (!route) files.push({ file, edits: [edit] });
  else
    for (const f of [file, ...others]) {
      const found = uses(f, entry.value, next, f === file ? entry.start : undefined);
      if (found === undefined || (found.length > 0 && inNodeModules(f.path))) return undefined;
      const edits = f === file ? [edit, ...found] : found;
      if (edits.length > 0) files.push({ file: f, edits });
    }
  const fix = files
    .map(({ file: f, edits }) => unifiedDiff(f.path, f.source, applyEdits(f.source, edits)))
    .filter((d) => d !== "")
    .join("\n");
  return fix === "" ? undefined : fix;
}
