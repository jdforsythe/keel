# k.check: Checker and diagnostics
status: implemented

**Pipeline.** `keel check [paths]`: one pass, incremental, under 1s warm on golden app 1.
1. Parse (oxc) and TS strict type check.
2. Compiler diagnostics (k.compiler transform of every file). They flow through unchanged: same code, location, message, and fix.
3. Rule registry: kernel structure rules plus rules from stdlib modules in the project's `deps` (k.module), run on each file with read-only project artifacts (`.keel/*.json`, manifests).
4. Rendered checks: every component and route rendered once under sim ctx (k.testing); axe-core plus `a11y.json` comparison.
5. Formatter: dedupe, sort by path, line, and col, group by code, cap, render per `--format` (k.cli).

Changing one file re-runs steps 1-4 for that file and its dependents only.

**Diagnostics.** Exactly the OUTPUT.md model: `{ kind: 'diag', code, path, line, col, message, fix?, see? }`. `code` is E (error), W (warning), or I (info) plus four digits, never renumbered; `message` is one line under 90 chars; `fix` is a unified diff hunk that applies to the checked tree; `see` is the spec section id. Only E codes affect the exit code (k.cli). A TS error that encodes a Keel rule (a missing a11y prop, an unknown field path, a string for `Href`) is reported under that rule's code; any other TS error is E1751.

**Codes.** `keel check` produces every code in the kernel sections' **Rules**, except codes produced by another command: dev and runtime (E1253, E1554), cli usage (E105x), scaffold operations (E135x), and harness results (E1702-E1706 from `keel test`, `keel ledger`). Those share this model, `explain`, and `spec --for`. Kernel codes are E1xxx; stdlib codes are E2xxx/W2xxx (spec/00-map.md).

**Registry** (extension point).
```ts
import { defineRule } from '@keel/check'
export const noRawMoney = defineRule({
  code: 'E2101', message: 'money as number; use Money', see: 'std.money',
  explain: 'Amounts are Money values. Replace number fields with s.money().',
  check: ({ file, ast, artifacts }) => findings,            // { path, line, col, data? }[]
  fix: (finding, { file }) => edits,                         // rendered as a unified diff
})
```
Rules are pure and deterministic: no `ctx`, no I/O beyond their inputs. A rule that throws is reported as E1756 and the other rules still run.

**explain and spec.** `keel explain <code>` prints at most 120 tokens: the message, the rule's `explain` (or the spec's Rules entry for kernel codes), one fix example, and `see`. `keel spec --for <code>` prints every spec line citing the code.

**Flags.** `--code <code>` keeps only that code (the summary still counts all) · `--limit N` sets the per-code cap (default 5), followed by `... +K more <code> (keel check --code <code>)` · `--quiet` prints the trailer only · `--format=compact|json|pretty`.

**Budgets.** Enforced from `budgets.json` (output tokens, gzip size per package or route). In the Keel repo: `keel check` on golden app 1 with 10 injected errors <= 600 tokens; `keel spec <id>` <= 1,500; spec map <= 1,200. A breach is E1755.

**Rules.** E1751 TS type error with no Keel rule code (message starts with the TS code) · E1752 file with more than one export, or filename not equal to its export (principle 3) · E1753 rule code registered twice, or a stdlib rule outside E2xxx/W2xxx · E1754 `unsafe` without a justification string · E1755 budget exceeded · E1756 rule threw.

**Conformance.**
- Every E code in a kernel section's Rules has an `explain` entry of at most 120 tokens and a fixture that triggers exactly that code.
- For the top 30 codes, applying the fix diff to its fixture with `git apply` succeeds, and re-checking reports no diagnostic of that code.
- The json diagnostic `keel check` emits for a compiler fixture is byte-identical to the one the compiler emits.
- Two runs on an unchanged tree produce identical output.
- Compact output for golden app 1 with 10 injected errors is at most 600 tokens.
- `--code E1501` emits only E1501 diagnostics while the summary counts every code.
- Registering one code twice reports E1753; a rule that throws reports E1756 and other rules' diagnostics still appear.
- A tree with only W diagnostics exits 0.
