import { type RuleDef, defineRule } from "@keel/check";

const rule = (code: string, message: string, explain: string): RuleDef =>
  defineRule({ code, see: "std.multi", message, explain, check: () => [] });

/**
 * E2007 (a group file fails `SessionGroup`) and E2008 (a group user's session has no `seed`), std.multi, k.check
 * registry. `keel session replay <f>` reports them at the file, 1:1, before any replay; the registry holds their
 * explanations.
 */
export const groupRules: readonly RuleDef[] = [
  rule(
    "E2007",
    "group file fails SessionGroup",
    "A group file must parse as SessionGroup. Fix: record it with openGroup.",
  ),
  rule(
    "E2008",
    "group user session has no seed",
    "Each user session needs the seed it drew ids from. Fix: record under simulation.",
  ),
];
