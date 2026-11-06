import { registry } from "./internal/registry.ts";
import type { RuleDef } from "./types/RuleDef.ts";

/**
 * Register a rule (k.check registry). Stdlib codes are E2xxx/W2xxx; a code outside that range, or one
 * already registered, throws an error whose message starts with E1753. Returns the registered rule.
 */
export function defineRule(def: RuleDef): RuleDef {
  if (!/^[EW]2\d{3}$/.test(def.code)) throw new Error(`E1753 rule code ${def.code} is outside E2xxx/W2xxx`);
  if (registry.has(def.code)) throw new Error(`E1753 rule code ${def.code} registered twice`);
  const rule: RuleDef = Object.freeze({ ...def });
  registry.set(rule.code, rule);
  return rule;
}
