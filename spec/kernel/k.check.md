# k.check: Checker and diagnostics
status: conformance-covered

**Pipeline.** `keel check [paths]`: one pass, incremental, under 1s warm on golden app 1. Static only: it never evaluates app code (rendered a11y checks are k.testing).
1. Parse (oxc) and TS strict type check. The only ambient types are Node's, loaded when `@types/node` resolves from the project root.
2. Compiler diagnostics (k.compiler transform of every file). They flow through unchanged: same code, location, message, and fix.
3. Rule registry: kernel structure rules plus rules from stdlib modules in the project's `deps` (k.module), run on each file with read-only project artifacts (`.keel/*.json`, manifests) and `project`: the project's code files and its `topology.ts`, one shared array.
4. Formatter: dedupe, sort by path, line, and col, group by code, cap, render per `--format` (k.cli).

Changing one file re-runs steps 1-3 for that file and its dependents only.

**Diagnostics.** Exactly the OUTPUT.md model: `{ kind: 'diag', code, path, line, col, message, fix?, see? }`. `code` is E (error), W (warning), or I (info) plus four digits, never renumbered; `message` is one line under 90 chars; `fix` is a unified diff hunk that applies to the checked tree; `see` is the spec section id. Only E codes affect the exit code (k.cli). A TS error that encodes a Keel rule (a missing a11y prop, an unknown field path, a string for `Href`) is reported under that rule's code; any other TS error is E1751.

**Codes.** `reportedCodes()` lists every code `keel check` produces: the pipeline's and each registered rule's. The other kernel **Rules** codes come from another command (build, cli, dev and runtime, scaffold, and harness results E1702-E1707 from `keel test`, `keel ledger`) and share this model, `explain`, and `spec --for`. Kernel codes are E1xxx; stdlib codes are E2xxx/W2xxx (spec/00-map.md).

**Registry** (extension point).
```ts
import { defineRule } from '@keel/check'
export const noRawMoney = defineRule({
  code: 'E2101', message: 'money as number; use Money', see: 'std.money',
  explain: 'Amounts are Money values, not numbers.',
  check: ({ file, ast, artifacts, project }) => findings,   // { path, line, col, data? }[]
  fix: (finding, { file }) => edits,                         // rendered as a unified diff
})
```
Rules are pure and deterministic: no `ctx`, no I/O beyond their inputs. A rule that throws is reported as E1756 and the other rules still run.

**explain and spec.** `keel explain <code>` prints at most 120 tokens: the message, the rule's `explain` (or the spec's Rules entry for kernel codes), one fix example, and `see`. `keel spec --for <code>` prints every spec line citing the code.

**Flags.** `--code <code>` keeps only that code (the summary still counts all) · `--limit N` sets the per-code cap (default 5), followed by `... +K more <code> (keel check --code <code>)` · `--quiet` prints the trailer only · `--format=compact|json|pretty`.

**Budgets.** Enforced from `budgets.json` (output tokens, gzip size per package or route). A breach is E1755.

**Rules.** E1751 TS type error with no Keel rule code (message starts with the TS code) · E1752 file with more than one export, filename not equal to its export, or a re-export outside `index.*` and `types/` (principle 3) · E1753 rule code registered twice, or a stdlib rule outside E2xxx/W2xxx · E1754 `unsafe` without a justification string · E1755 budget exceeded · E1756 rule threw · E1757 cast, non-null assertion, `any`, or ts-suppression outside `unsafe/` · E1758 ambient locale or time zone in app code: `navigator.language` or `languages`; an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale; an `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`; a local-time getter (`getHours`, ...) on a `new Date(...)` expression. Names resolve as for E1601; no fix.

**Conformance.**
- Every E code in a kernel section's Rules or in `reportedCodes()` has an `explain` entry of at most 120 tokens. Each one `check()` reports (`reportedCodes()`) has a fixture that triggers exactly that code (E1756: a registered rule that throws); each other Rules code comes from another command and a conformance test of its own package asserts it (outside comments and test titles).
- Every fix a diagnostic carries applies to its fixture with `git apply`, and re-checking reports no diagnostic of that code. Fixtures of E1003, E1005 (bytes only), E1151, E1152, E1154-E1157, E1401, E1403 (`&&`, `?:` with `If` imported), E1405, E1451, E1452 (`try`), E1601, E1652, E1653, E1757 (`!`, `any`, suppression), E1805, and E1808 carry one; RFC 0035 lists why the others cannot.
- The json diagnostic `keel check` emits for a compiler fixture is byte-identical to the one the compiler emits.
- `check()` never evaluates app code: a module that throws at top level yields only static diagnostics.
- Two runs on an unchanged tree produce identical output.
- Compact output for golden app 1 with 10 injected errors is at most 600 tokens.
- `--code E1501` emits only E1501 diagnostics while the summary counts every code.
- Registering one code twice reports E1753; a rule that throws reports E1756 and other rules' diagnostics still appear.
- A tree with only W diagnostics exits 0.
- A base element given `children: Input(...)`, also through an aliased import, in an array, or held by a `const`, reports E1808; a thunk, a string or `props.children` does not.
- A rule receives, as read-only `project`, every code file of its file's project and that project's `topology.ts`, the same array for each file it checks.
- A file reading `process.env` and importing `node:path` checks clean in a project whose root resolves `@types/node` and reports E1751 in one whose root does not.
- `n.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(0).getHours()` are each one E1758; `a.localeCompare(b, 'de-DE')` and `new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })` none.
