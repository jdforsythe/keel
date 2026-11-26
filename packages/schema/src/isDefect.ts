import { defects } from "./internal/defects.ts";
import type { Defect } from "./types/Defect.ts";

/** Whether `x` is a value `defect` threw, and with `code` whether it carries that code (k.errors Defects). */
export function isDefect(x: unknown, code?: string): x is Defect {
  if (typeof x !== "object" || x === null || !defects.has(x)) return false;
  return code === undefined || Reflect.get(x, "code") === code;
}
