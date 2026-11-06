import type { RuleDef } from "../types/RuleDef.ts";
import { KERNEL_RULES } from "./KERNEL_RULES.ts";

/** The rule registry (k.check extension point): code -> rule. Kernel rules first; `defineRule` adds stdlib rules. */
export const registry: Map<string, RuleDef> = new Map(KERNEL_RULES.map((r) => [r.code, r]));
