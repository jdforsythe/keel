import type { Finding, SourceFile } from "@keel/check";
import type { CallExpression } from "oxc-parser";
import { keyOf } from "./keyOf.ts";
import { lineCol } from "./lineCol.ts";
import { moduleFile } from "./moduleFile.ts";

/**
 * For each call, a finding when `file` is not `modules/<id>/<home>`, else one per key of its table argument (at
 * `arg`) that is not prefixed `<id>.`, carrying the edit that prefixes it.
 */
export function keyFindings(file: SourceFile, calls: readonly CallExpression[], home: string, arg: number): Finding[] {
  const mf = moduleFile(file.path);
  const out: Finding[] = [];
  for (const c of calls) {
    if (mf?.rest !== home) {
      out.push({ path: file.path, ...lineCol(file.source, c.start), data: { home } });
      continue;
    }
    const table = c.arguments[arg];
    if (table?.type !== "ObjectExpression") continue;
    for (const p of table.properties) {
      const key = p.type === "Property" ? keyOf(p) : undefined;
      if (p.type !== "Property" || key === undefined || key.startsWith(`${mf.id}.`)) continue;
      const text = JSON.stringify(`${mf.id}.${key}`);
      out.push({
        path: file.path,
        ...lineCol(file.source, p.key.start),
        data: { key, id: mf.id, start: p.key.start, end: p.key.end, text },
      });
    }
  }
  return out;
}
