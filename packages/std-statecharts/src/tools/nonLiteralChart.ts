import { type RuleDef, defineRule } from "@keel/check";
import { ruleOf } from "./internal/ruleOf.ts";

/**
 * E2755 (std.statecharts, k.check registry): a `chart` whose declaration, `initial`, `states`, a state, its `final`,
 * its `on` keys or a target is not a literal, so the checker cannot prove the chart. No fix.
 */
export const nonLiteralChart: RuleDef = defineRule({
  code: "E2755",
  see: "std.statecharts",
  explain: "keel check reads the chart as written. Fix: write initial, states, on keys and targets inline as literals.",
  ...ruleOf("E2755"),
});
