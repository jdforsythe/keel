import { type RuleDef, defineRule } from "@keel/check";
import { ruleOf } from "./internal/ruleOf.ts";

/**
 * E2753 (std.statecharts, k.check registry): a non-final state with no target to another state. The fix makes a state
 * with no `on` entries `{ final: true }`.
 */
export const stuckState: RuleDef = defineRule({
  code: "E2753",
  see: "std.statecharts",
  explain:
    "A state that is not final needs a way out: a target whose to names another state. Fix: stuck: {} -> stuck: { final: true }. chart throws it too.",
  ...ruleOf("E2753"),
});
