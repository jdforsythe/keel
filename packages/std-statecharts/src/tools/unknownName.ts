import { type RuleDef, defineRule } from "@keel/check";
import { ruleOf } from "./internal/ruleOf.ts";

/**
 * E2754 (std.statecharts, k.check registry): a final state with `on`, an `on` event missing from `events`, or a
 * `guard` or `do` naming no entry of `guards` or `actions`. No fix.
 */
export const unknownName: RuleDef = defineRule({
  code: "E2754",
  see: "std.statecharts",
  explain:
    "A final state takes no events; on keys name events, guard names a guards entry and do an actions entry. chart throws it too.",
  ...ruleOf("E2754"),
});
