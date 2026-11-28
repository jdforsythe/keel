import type { AxeInternals } from "../src/internal/AxeInternals.ts";
import { unsafe } from "./unsafe.ts";

const isObject = (v: unknown): v is object => (typeof v === "object" || typeof v === "function") && v !== null;

/**
 * Whether `x` holds every member of `Internals` this file calls or sets, as axe-core 4.14.0 (pinned in package.json)
 * does: the rule list and `after`, the Context constructor, the three utilities and `teardown`. The members' own
 * signatures are axe's; the a11y tests run every rule through them.
 */
function holdsInternals(x: unknown): boolean {
  if (!isObject(x) || !("_audit" in x && "utils" in x && "_thisWillBeDeletedDoNotUse" in x && "teardown" in x))
    return false;
  const { _audit: audit, utils, _thisWillBeDeletedDoNotUse: hidden } = x;
  if (!isObject(audit) || !("rules" in audit && "after" in audit)) return false;
  if (!isObject(utils) || !("getSelectorData" in utils && "publishMetaData" in utils && "finalizeRuleResult" in utils))
    return false;
  if (!isObject(hidden) || !("base" in hidden) || !isObject(hidden.base) || !("Context" in hidden.base)) return false;
  return (
    Array.isArray(audit.rules) &&
    typeof audit.after === "function" &&
    typeof hidden.base.Context === "function" &&
    typeof utils.getSelectorData === "function" &&
    typeof utils.publishMetaData === "function" &&
    typeof utils.finalizeRuleResult === "function" &&
    typeof x.teardown === "function"
  );
}

/** The axe-core module `x` as its internals, after checking that each member `axeSync` uses is present. */
export function axeInternals(x: unknown): AxeInternals {
  if (!holdsInternals(x)) throw new Error("axe-core's internals are not those of 4.14.0, which @keel/testing runs");
  return unsafe(
    "axe-core is pinned to 4.14.0 in package.json and holdsInternals found every member declared in AxeInternals; the a11y tests run every rule through it",
    () => x as AxeInternals,
  );
}
