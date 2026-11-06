import { callArgObject } from "./callArgObject.ts";
import { isGenerated } from "./isGenerated.ts";
import { keyName } from "./keyName.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { sortedKeys } from "./sortedKeys.ts";

/** Every route declared in a `routes.ts` manifest of the tree: id -> declaring file and path (null for layouts). */
export function routeTable(files: ReadonlyMap<string, string>): Map<string, { file: string; path: string | null }> {
  const out = new Map<string, { file: string; path: string | null }>();
  for (const file of sortedKeys(files.keys())) {
    const src = files.get(file);
    if (src === undefined || isGenerated(file) || !/(^|\/)routes\.tsx?$/.test(file)) continue;
    const program = parseSource(file, src);
    const obj = program === null ? null : callArgObject(program, "manifest");
    for (const p of obj?.properties ?? []) {
      const id = keyName(p);
      if (id === null || p.type !== "Property") continue;
      const v = p.value.type === "ObjectExpression" ? propertyValue(p.value, "path") : null;
      out.set(id, { file, path: v?.type === "Literal" && typeof v.value === "string" ? v.value : null });
    }
  }
  return out;
}
