import type { RuleDef } from "../types/RuleDef.ts";
import { KERNEL_RULES } from "./KERNEL_RULES.ts";
import { registrations } from "./registrations.ts";

const kernel: ReadonlyMap<string, RuleDef> = new Map(KERNEL_RULES.map((r) => [r.code, r]));

/** The rule registry (k.check extension point): code -> rule. Kernel rules first, then the rules `defineRule` added. */
export function registry(): ReadonlyMap<string, RuleDef> {
  return new Map([...kernel, ...registrations]);
}
