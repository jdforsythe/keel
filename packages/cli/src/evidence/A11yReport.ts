import { s } from "@keel/schema";

/**
 * `a11y.json` (k.evidence, k.a11y Claims): per route and criterion its rung and the rules mapped to it, the criteria
 * no rule maps to (for a person), and `contrastTable(tokens)` of the app's tokens.
 */
export const A11yReport = s.object({
  v: s.literal(1),
  claims: s.array(
    s.object({
      route: s.string(),
      criterion: s.string(),
      rung: s.enum(["none", "example"]),
      rules: s.array(s.string()),
    }),
  ),
  person: s.array(s.string()),
  contrast: s.array(s.object({ scheme: s.enum(["light", "dark"]), fg: s.string(), bg: s.string(), ratio: s.number() })),
});
