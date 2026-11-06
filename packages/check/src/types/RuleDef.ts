import type { Program } from "oxc-parser";
import type { Edit } from "./Edit.ts";
import type { Finding } from "./Finding.ts";
import type { RuleInput } from "./RuleInput.ts";
import type { SourceFile } from "./SourceFile.ts";

/**
 * A rule (k.check registry). Pure and deterministic: no `ctx`, no I/O beyond its input. `message` is one
 * line under 90 chars, or a function of the finding for kernel rules that name what they found. `fix`
 * returns edits (rendered as a unified diff) or `null` when a finding has no mechanical fix.
 */
export type RuleDef = {
  readonly code: string;
  readonly message: string | ((finding: Finding) => string);
  readonly explain: string;
  readonly see?: string;
  readonly check: (input: RuleInput) => readonly Finding[];
  readonly fix?: (
    finding: Finding,
    input: { readonly file: SourceFile; readonly ast: Program },
  ) => readonly Edit[] | null;
};
