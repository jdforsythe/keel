import { type RuleDef, defineRule } from "@keel/check";
import { ruleOf } from "./internal/ruleOf.ts";

/** E2751 (std.statecharts, k.check registry): `initial` or a `to` naming no state; the fix writes the nearest name. */
export const unknownState: RuleDef = defineRule({
  code: "E2751",
  see: "std.statecharts",
  explain:
    "initial and every to name a key of states. Fix: the nearest state name, initial: 'veiwing' -> initial: 'viewing'. chart throws it too.",
  ...ruleOf("E2751"),
});
