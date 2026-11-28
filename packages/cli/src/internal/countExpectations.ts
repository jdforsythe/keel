import { parseSync } from "oxc-parser";
import { isExpectation } from "./isExpectation.ts";

/** The expectations (`isExpectation`) among the comments of a negative type test's `source`. */
export function countExpectations(path: string, source: string): number {
  const lang = path.endsWith(".tsx") ? "tsx" : "ts";
  return parseSync(path, source, { sourceType: "module", lang }).comments.filter((c) => isExpectation(c.value)).length;
}
