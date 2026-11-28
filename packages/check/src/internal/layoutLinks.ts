import { readContract } from "@keel/compiler/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { ModuleContract } from "./ModuleContract.ts";
import { bindingCalls } from "./bindingCalls.ts";
import { diagAt } from "./diagAt.ts";
import { isTestPath } from "./isTestPath.ts";
import { propertyOf } from "./propertyOf.ts";

/** One binding entry's literal `layout`: the entry id, the layout id, and where the value starts. */
type Link = { readonly id: string; readonly layout: string; readonly file: SourceFile; readonly at: number };

const prefixOf = (id: string): string => id.slice(0, Math.max(0, id.indexOf(".")));

/**
 * Module `mc`'s contract as the shared static reader (`readContract`) reads it: the ids of its layout entries (an
 * entry with `layout` and no `method`, k.contract) and whether any part of it was not read.
 */
function layoutsOf(mc: ModuleContract): { readonly ids: readonly string[]; readonly partial: boolean } {
  const entries = mc.contract.call.arguments[1];
  if (entries === undefined) return { ids: [], partial: true };
  const ids: string[] = [];
  let partial = false;
  for (const item of readContract(entries)) {
    if (item.kind === "gap") partial = true;
    else {
      if (item.gaps.length > 0) partial = true;
      if (item.members.has("layout") && !item.members.has("method")) ids.push(item.id);
    }
  }
  return { ids, partial };
}

/** The literal `layout` of every binding entry in module `mc`'s non-test files. */
function linksOf(mc: ModuleContract, files: readonly Checked[]): Link[] {
  const root = `${mc.dir}modules/${mc.module}/`;
  const out: Link[] = [];
  for (const { file, parsed } of files) {
    if (!file.path.startsWith(root) || isTestPath(file.path.slice(root.length))) continue;
    for (const call of bindingCalls(file, parsed.program))
      for (const { id, obj } of call.list) {
        const v = obj === null ? undefined : propertyOf(obj, "layout")?.value;
        if (v?.type === "Literal" && typeof v.value === "string") out.push({ id, layout: v.value, file, at: v.start });
      }
  }
  return out;
}

/**
 * E1506 (k.routes Layouts) over each deployable's route table (`tables`): a binding's `layout` naming an id of
 * another module that is no layout entry of the table (that module placed elsewhere, or no such entry), or that
 * closes a cycle, at the `layout` value. Ids of the binding's own module are the type error's and `manifest`'s; a
 * prefix in `skip` (a stdlib module, whose contract the check does not read) is not judged; contracts are read by
 * `readContract`, and a table with a partly unread contract reports no missing layout. One diagnostic per `layout` value across the tables.
 */
export function layoutLinks(
  files: readonly Checked[],
  tables: readonly ModuleContract[][],
  skip: ReadonlySet<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  const report = (l: Link, message: string): void => {
    const key = `${l.file.path}:${l.at}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(diagAt(l.file, l.at, "E1506", message, "k.routes"));
  };
  for (const table of tables) {
    const read = table.map(layoutsOf);
    const layouts = new Set(read.flatMap((r) => r.ids));
    const partial = read.some((r) => r.partial);
    const links = table.flatMap((mc) => linksOf(mc, files).map((l) => ({ mc, l })));
    const next = new Map(links.map(({ l }) => [l.id, l.layout]));
    for (const { mc, l } of links) {
      const owner = prefixOf(l.layout);
      if (owner === mc.module || skip.has(owner)) continue;
      if (!layouts.has(l.layout)) {
        if (!partial) report(l, `${l.id}: layout "${l.layout}" names no layout entry of the deployable's table`);
        continue;
      }
      const chain = [l.id];
      for (let cur: string | undefined = l.layout; cur !== undefined; cur = next.get(cur)) {
        if (cur === l.id) {
          report(l, `${l.id}: layout cycle ${[...chain, cur].join(" in ")}`);
          break;
        }
        if (chain.includes(cur)) break;
        chain.push(cur);
      }
    }
  }
  return out;
}
