import { isCode } from "./isCode.ts";
import { parseSource } from "./parseSource.ts";
import { schemaObject } from "./schemaObject.ts";
import { sortedKeys } from "./sortedKeys.ts";

/** Paths (sorted, generated locations included) that declare `export const <name> = s.object(...)`. */
export function findSchema(files: ReadonlyMap<string, string>, name: string): string[] {
  const out: string[] = [];
  for (const p of sortedKeys(files.keys())) {
    const src = files.get(p);
    if (src === undefined || !isCode(p) || !src.includes(name)) continue;
    const program = parseSource(p, src);
    if (program !== null && schemaObject(program, name) !== null) out.push(p);
  }
  return out;
}
