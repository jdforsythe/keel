import { clipMessage } from "@keel/schema/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { RuleInput } from "../types/RuleInput.ts";
import { applyEdits } from "./applyEdits.ts";
import { fixElsewhere } from "./fixElsewhere.ts";
import { ruleThrew } from "./ruleThrew.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/**
 * Codes whose messages k.errors and k.shared print word for word, longer than the 89 units of k.check Diagnostics:
 * they are kept whole, since a clipped one would drop the shape or the home it names.
 */
const WHOLE: ReadonlySet<string> = new Set(["E1451", "E1452", "E1256"]);

function toDiagnostic(rule: RuleDef, f: Finding, input: RuleInput): Diagnostic {
  const text = typeof rule.message === "string" ? rule.message : rule.message(f);
  const base: Diagnostic = {
    kind: "diag",
    code: rule.code,
    path: f.path,
    line: f.line,
    col: f.col,
    message: clipMessage(text, WHOLE.has(rule.code) ? Number.MAX_SAFE_INTEGER : 89),
  };
  const withSee: Diagnostic = rule.see === undefined ? base : { ...base, see: rule.see };
  const elsewhere = fixElsewhere.get(f);
  if (elsewhere !== undefined && elsewhere !== "") return { ...withSee, fix: elsewhere };
  const edits = rule.fix?.(f, { file: input.file, ast: input.ast }) ?? null;
  if (edits === null || edits.length === 0) return withSee;
  const fix = unifiedDiff(input.file.path, input.file.source, applyEdits(input.file.source, edits));
  return fix === "" ? withSee : { ...withSee, fix };
}

/**
 * Run every rule on one file (pipeline step 3). A rule whose `check`, `message`, or `fix` throws yields one
 * E1756 naming it, and the other rules still run.
 */
export function runRules(all: readonly RuleDef[], input: RuleInput): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const rule of all) {
    try {
      const mine = rule.check(input).map((f) => toDiagnostic(rule, f, input));
      out.push(...mine);
    } catch (e) {
      out.push(ruleThrew(rule, input.file.path, e));
    }
  }
  return out;
}
