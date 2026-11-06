import { compile } from "@keel/compiler";
import type { Checked } from "./internal/Checked.ts";
import { budgetBreaches } from "./internal/budgetBreaches.ts";
import { duplicateErrorCodes } from "./internal/duplicateErrorCodes.ts";
import { generatedEdits } from "./internal/generatedEdits.ts";
import { isCodePath } from "./internal/isCodePath.ts";
import { normalize } from "./internal/normalize.ts";
import { parseFile } from "./internal/parseFile.ts";
import { renderA11y } from "./internal/renderA11y.ts";
import { ruleCodeDeclarations } from "./internal/ruleCodeDeclarations.ts";
import { runRules } from "./internal/runRules.ts";
import { summarize } from "./internal/summarize.ts";
import { typeCheck } from "./internal/typeCheck.ts";
import { rules } from "./rules.ts";
import type { CheckOptions } from "./types/CheckOptions.ts";
import type { CheckResult } from "./types/CheckResult.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";

const isError = (d: Diagnostic): boolean => !/^[WI]/.test(d.code);

/**
 * `keel check` over in-memory files (k.check pipeline): (1) oxc parse and strict TS check, (2) compiler
 * diagnostics passed through unchanged, (3) the rule registry on each file plus project passes (E1005,
 * E1454, E1753, E1755), (4) rendered a11y checks, (5) dedupe and sort. Pure and deterministic for equal inputs.
 */
export function check(files: readonly SourceFile[], opts: CheckOptions = {}): CheckResult {
  const code = files.filter((f) => isCodePath(f.path));
  const compiled = compile(code);
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
    ...ruleCodeDeclarations(checked),
    ...budgetBreaches(opts.budgets ?? []),
    ...generatedEdits(files, opts.artifacts ?? {}),
  );

  if (opts.render !== false) {
    const failing = new Set(out.filter(isError).map((d) => d.path));
    const outputs = new Map(compiled.outputs.map((o) => [o.path, o.code]));
    for (const { file, parsed } of checked) {
      const js = outputs.get(file.path);
      if (js !== undefined && !failing.has(file.path)) out.push(...renderA11y(file, js, parsed.program));
    }
  }
  const diagnostics = normalize(out);
  return { diagnostics, summary: summarize(diagnostics) };
}
