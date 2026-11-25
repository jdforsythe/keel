import axe from "axe-core";
import type { AxeRuleInfo } from "./AxeRuleInfo.ts";

/** One rule of axe's `_audit.rules` as the harness reads it, or `undefined` when it lacks that shape. */
function ruleInfo(rule: unknown): AxeRuleInfo | undefined {
  if (typeof rule !== "object" || rule === null) return undefined;
  if (!("id" in rule) || !("tags" in rule) || !("enabled" in rule)) return undefined;
  const { id, tags, enabled } = rule;
  if (typeof id !== "string" || typeof enabled !== "boolean" || !Array.isArray(tags)) return undefined;
  const names = tags.filter((t): t is string => typeof t === "string");
  return names.length === tags.length ? { id, tags: names, enabled } : undefined;
}

/**
 * Every rule axe-core 4.14.0 loads, with its tags and default `enabled` (axe's `getRules` omits `enabled`), read from
 * its untyped `_audit.rules` and checked field by field. A list or rule of another shape (an axe-core whose internals
 * moved) throws, so no rule is silently left out of a render or a claim.
 */
export function axeRuleList(): readonly AxeRuleInfo[] {
  const audit: unknown = Reflect.get(axe, "_audit");
  const rules = typeof audit === "object" && audit !== null && "rules" in audit ? audit.rules : undefined;
  if (!Array.isArray(rules)) throw new Error("axe-core has no _audit.rules list; the pinned axe-core 4.14.0 has one");
  return rules.map((r: unknown) => {
    const info = ruleInfo(r);
    if (info === undefined)
      throw new Error("axe-core _audit rule without a string id, string tags and boolean enabled");
    return info;
  });
}
