import { kernelSet } from "./internal/kernelSet.ts";
import type { Defect } from "./types/Defect.ts";

/**
 * Whether `x` is a value `defect` made in this realm (k.defects), read from the kernel's record (k.identity), and with
 * `code`, whether it was made with that code. No property of the value proves it.
 */
export function isDefect(x: unknown, code?: string): x is Defect {
  if (typeof x !== "object" || x === null || !kernelSet("defect").has(x)) return false;
  return code === undefined || Object.getOwnPropertyDescriptor(x, "code")?.value === code;
}
