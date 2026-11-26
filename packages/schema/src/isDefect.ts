import { DEFECT_KEY } from "./internal/DEFECT_KEY.ts";
import type { Defect } from "./types/Defect.ts";

/**
 * Whether `x` is a defect (k.errors Defects): an object holding the own key `Symbol.for('keel.defect')`, so a defect of
 * any copy of `@keel/schema` is one, and with `code`, whether it carries that code.
 */
export function isDefect(x: unknown, code?: string): x is Defect {
  if (typeof x !== "object" || x === null || !Object.hasOwn(x, DEFECT_KEY)) return false;
  return code === undefined || Object.getOwnPropertyDescriptor(x, "code")?.value === code;
}
