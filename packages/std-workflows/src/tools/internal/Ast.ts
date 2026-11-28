import type { RuleInput } from "@keel/check";

/** The oxc AST `keel check` hands a rule for one file. */
export type Ast = RuleInput["ast"];
