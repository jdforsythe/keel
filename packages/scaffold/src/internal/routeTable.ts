import type { RouteDef } from "./RouteDef.ts";
import { callArgObject } from "./callArgObject.ts";
import { isGenerated } from "./isGenerated.ts";
import { keyName } from "./keyName.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { sortedKeys } from "./sortedKeys.ts";

const text = (v: ReturnType<typeof propertyValue>): string | null =>
  v?.type === "Literal" && typeof v.value === "string" ? v.value : null;

/** Every route declared in a `<id>.contract.ts` of the tree: id -> declaring file, path and method. */
export function routeTable(files: ReadonlyMap<string, string>): Map<string, RouteDef> {
  const out = new Map<string, RouteDef>();
  for (const file of sortedKeys(files.keys())) {
    const src = files.get(file);
    if (src === undefined || isGenerated(file) || !/(^|\/)[^/]+\.contract\.tsx?$/.test(file)) continue;
    const program = parseSource(file, src);
    const obj = program === null ? null : callArgObject(program, "contract", 1);
    for (const p of obj?.properties ?? []) {
      const id = keyName(p);
      if (id === null || p.type !== "Property") continue;
      const entry = p.value.type === "ObjectExpression" ? p.value : null;
      out.set(id, {
        file,
        path: entry === null ? null : text(propertyValue(entry, "path")),
        method: entry === null ? null : text(propertyValue(entry, "method")),
      });
    }
  }
  return out;
}
