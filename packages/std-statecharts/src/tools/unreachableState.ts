import { type RuleDef, defineRule } from "@keel/check";
import { ruleOf } from "./internal/ruleOf.ts";

/**
 * E2752 (std.statecharts, k.check registry): a state no chain of `on` targets reaches from `initial`, every guard
 * taken as possibly true, so no run ever holds it. No fix.
 */
export const unreachableState: RuleDef = defineRule({
  code: "E2752",
  see: "std.statecharts",
  explain:
    "Every guard counts as possibly true here, so no run reaches the state. Fix: add a target to it, or delete it.",
  ...ruleOf("E2752"),
});
