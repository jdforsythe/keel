import type { RuleDef } from "../types/RuleDef.ts";

/** Rules registered through `defineRule` (k.check registry), code -> rule. Both entries of the package read this one map. */
export const registrations: Map<string, RuleDef> = new Map();
