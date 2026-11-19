import { Visitor } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { keyName } from "../keyName.ts";
import { parseFile } from "../parseFile.ts";

/** Offset of the first object property keyed `key` in `file` (a route id in its manifest), else 0. */
export function keyAt(file: SourceFile, key: string): number {
  let at = -1;
  new Visitor({
    ObjectExpression: (o) => {
      for (const p of o.properties) if (at < 0 && p.type === "Property" && keyName(p) === key) at = p.start;
    },
  }).visit(parseFile(file).program);
  return Math.max(at, 0);
}
