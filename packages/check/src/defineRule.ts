import { stdImporting } from "@keel/compiler/std/stdImporting";
import { callerPackage } from "./internal/callerPackage.ts";
import { depsRuleOwners } from "./internal/depsRuleOwners.ts";
import { registrations } from "./internal/registrations.ts";
import { registry } from "./internal/registry.ts";
import { ruleOwners } from "./internal/ruleOwners.ts";
import type { RuleDef } from "./types/RuleDef.ts";

/**
 * Register a rule (k.check registry). Stdlib codes are E2xxx/W2xxx; a code outside that range, or one
 * already registered, throws an error whose message starts with E1753, `E1753 rule code <code> is registered by <a> and
 * <b>` when two packages register it (`<a>` the first). Returns the registered rule. A rule a
 * library (k.library) registers while `importDeps` imports it first runs only while `deps` reach the package
 * (k.check-cache In one process).
 */
export function defineRule(def: RuleDef & { readonly explain: string }): RuleDef {
  if (!/^[EW]2\d{3}$/.test(def.code)) throw new Error(`E1753 rule code ${def.code} is outside E2xxx/W2xxx`);
  const owner = callerPackage();
  if (registry().has(def.code)) {
    const first = ruleOwners.get(def.code) ?? null;
    if (first === null || owner === null || first === owner)
      throw new Error(`E1753 rule code ${def.code} registered twice`);
    throw new Error(`E1753 rule code ${def.code} is registered by ${first} and ${owner}`);
  }
  const rule: RuleDef = Object.freeze({ ...def });
  registrations.set(rule.code, rule);
  ruleOwners.set(rule.code, owner);
  if (owner !== null && stdImporting(owner)) depsRuleOwners.add(owner);
  return rule;
}
