import { compile } from "@keel/compiler";
import type { Checked } from "./internal/Checked.ts";
import { budgetBreaches } from "./internal/budgetBreaches.ts";
import { duplicateErrorCodes } from "./internal/duplicateErrorCodes.ts";
import { generatedEdits } from "./internal/generatedEdits.ts";
import { isCodePath } from "./internal/isCodePath.ts";
import { moduleChecks } from "./internal/modules/moduleChecks.ts";
import { normalize } from "./internal/normalize.ts";
import { parseFile } from "./internal/parseFile.ts";
import { ruleCodeDeclarations } from "./internal/ruleCodeDeclarations.ts";
import { runRules } from "./internal/runRules.ts";
import { summarize } from "./internal/summarize.ts";
import { typeCheck } from "./internal/typeCheck.ts";
import { rules } from "./rules.ts";
import type { CheckOptions } from "./types/CheckOptions.ts";
import type { CheckResult } from "./types/CheckResult.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/**
 * `keel check` over in-memory files (k.check pipeline): (1) oxc parse and strict TS check, (2) compiler
 * diagnostics passed through unchanged, (3) the rule registry on each file plus project passes (E1005,
 * E1454, E1753, E1755, and the k.module pass E1151-E1157), (4) dedupe and sort. Static only: no app code is
 * evaluated (rendered a11y is `keel test`, rfc:0023). Pure and deterministic for equal inputs.
 */
export function check(files: readonly SourceFile[], opts: CheckOptions = {}): CheckResult {
  const code = files.filter((f) => isCodePath(f.path));
  const compiled = compile(code, opts.topology === undefined ? {} : { topology: opts.topology });
  const out: Diagnostic[] = compiled.diagnostics.map((d) => ({ kind: "diag", ...d }));
  const reported = new Map<string, Set<string>>();
  for (const d of compiled.diagnostics) reported.set(d.path, (reported.get(d.path) ?? new Set()).add(d.code));

  if (opts.types !== false) out.push(...typeCheck(code, opts.root ?? process.cwd(), reported));

  const artifacts: Readonly<Record<string, unknown>> = { ...compiled.artifacts, ...opts.artifacts };
  const registered = rules();
  const checked: Checked[] = [];
  for (const file of code) {
    const parsed = parseFile(file);
    if (!parsed.ok) continue;
    checked.push({ file, parsed });
    out.push(...runRules(registered, { file, ast: parsed.program, artifacts }));
  }
  out.push(
    ...duplicateErrorCodes(checked),
    ...moduleChecks(checked),
    ...ruleCodeDeclarations(checked),
    ...budgetBreaches(opts.budgets ?? []),
    ...generatedEdits(files, opts.artifacts ?? {}),
  );

  const diagnostics = normalize(out);
  return { diagnostics, summary: summarize(diagnostics) };
}
