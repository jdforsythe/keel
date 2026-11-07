# RFC 0065: `reportedCodes()` decides which codes need a check fixture, and E1603 follows a URL or constructor to its origin

Status: accepted (ADR-0054)

## Problem
- **Backlog 0173.** k.check's first Conformance clause asked for a fixture for every E code in a kernel section's Rules. 38 of the 83 Rules codes had none, so `explain-and-fixture-per-code.test.ts` ran it as `test.fails` and k.check stayed `implemented`.
  - 36 of the 38 come from another command. `check()` never evaluates app code, so a static fixture cannot trigger them:
    - build (E1006, E1049, E1807);
    - cli and inspect (E1051-E1054, E1056, E1057);
    - reactive runtime (E1201-E1203, E1205, E1206);
    - resume (E1253);
    - scaffold (E1351-E1354);
    - router runtime (E1502-E1506);
    - server (E1552-E1555);
    - harness and ledger (E1702-E1707);
    - ui runtime (E1801);
    - forms runtime (E1902).
  - Two are reported by `check()`. E1804 is the `lowContrast` rule, which needs a `tokens` artifact. E1756 is the runner's code for a rule that throws, and no kernel rule throws.
  - The k.check Codes paragraph named only some of the other commands (E1253, E1554, E1555, E105x, E135x, E1702-E1707).
  - `fixture-per-code.test.ts` kept a hand list of 38 explain-only codes. Nothing tied that list to what `check()` reports.
- **Backlog 0177.** E1603 read only the outermost form of an `import()` or `Worker` argument. Each of these gave `[]`:
  - `` import(`${URL.createObjectURL(new Blob([s]))}`) ``, `import(URL.createObjectURL(…) + '')` and `import(String(URL.createObjectURL(…)))`;
  - `new Worker(new URL(URL.createObjectURL(…)))` and `Reflect.construct(Worker, [URL.createObjectURL(…)])`;
  - `let u; u = URL.createObjectURL(…); import(u)`;
  - `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)`, which is the `Function` constructor itself;
  - `Object.getPrototypeOf(o.m).constructor(s)` with `const o = { async m() {} }`.

## Proposal
1. **`reportedCodes()` (k.check, public).** `@keel/check` exports `reportedCodes(): string[]`. It returns every code `check()` can report, sorted:
   - the pipeline's own codes (`PIPELINE_CODES`):
     - parse and types: E1000, E1001, E1003, E1453, E1501, E1751, E1802;
     - compiler diagnostics passed through: E1002, E1004, E1401-E1404, W1005;
     - project passes: E1005, E1151-E1158, E1454, E1508, E1753, E1755;
     - the runner: E1756.
   - each registered rule's code, kernel or stdlib.
2. **Amended clause (k.check Conformance 1).** "Every E code in a kernel section's Rules or in `reportedCodes()` has an `explain` entry of at most 120 tokens. Each one `check()` reports (`reportedCodes()`) has a fixture that triggers exactly that code (E1756: a registered rule that throws); each other Rules code comes from another command and a conformance test of its own package asserts it (outside comments and test titles)."
   - With this clause, the codes that need a fixture are the ones `check()` reports, not a hand list. Any other Rules code must be named by another package's conformance.
3. **Classification of the 38.**
   - (a) Two are reported by `check()`. E1804 gets a fixture with a `tokens` artifact. E1756 gets a rule, registered in the test, that throws on one path.
   - (b) 36 come from another command. Each is already named by its own package's conformance, which the test checks by reading `packages/*/conformance`.
   - No code moves out of Rules.
   - `reportedCodes()` also lists E1401-E1404. These are k.component codes from its Control flow and IDs paragraphs, so they get fixtures too.
4. **k.check Codes paragraph.** It now says: "`reportedCodes()` lists every code `keel check` produces: the pipeline's and each registered rule's. The other kernel **Rules** codes come from another command (build, cli, dev and runtime, scaffold, and harness results E1702-E1707 from `keel test`, `keel ledger`; rfc:0065)…"
5. **k.check becomes `conformance-covered`.** This clause was the only gap (RFC 0049 table; backlog 0138).
6. **E1603 origin walk (k.ctx, backlog 0177).** The rule follows a URL to where it came from. A `blob:` or `data:` origin is E1603:
   - a constant prefix, or `URL.createObjectURL(...)`;
   - `String(u)`, `u.toString()`, `u.valueOf()`, `new URL(u)` and `.href`;
   - a template or `+` whose constant prefix is empty. The first part that is not constant is followed;
   - `?:`, `&&`, `||` and `??` (either side);
   - a property of an object literal;
   - every value a local's binding is given: its declaration and each `=`, `||=`, `&&=` or `??=` assignment to the same binding. The shared resolver gains `sameBinding(name, a, b)`, which compares the declarations `lookup` finds, so a parameter is never matched with another function's local of the same name (backlog 0187).
   - `Reflect.construct(Worker | SharedWorker, [u])` is checked like `new Worker(u)`.
7. **Prototype chain.** A function value is in the `Function` family for a set number of prototype steps:
   - two for an async or generator function: `AsyncFunction.prototype`, then `Function.prototype`;
   - one for a plain function or class;
   - none for `Function.prototype` itself.

   `Object.getPrototypeOf` and `Reflect.getPrototypeOf` each use one step. `.constructor` on a value that still has a step left is the `Function` constructor family. This holds when it is called, constructed, used through `.call`/`.apply`/`.bind`, or passed to `Reflect.apply`/`construct`, directly or through an alias. Object literal methods are function values. So `Object.getPrototypeOf(Object.getPrototypeOf(() => {})).constructor` (`Object`) stays clean.
8. **Not covered.** Values that flow through a call or another file, a class's `prototype` methods, and `+=`.

9. **Assertions, not mentions (backlog 0186).** A code counts as asserted by another package only when it appears on an assertion line of a conformance file: `expect(`, `toThrow(`, `toEqual(`, `toMatchObject(`, `toContain(`, `toBe(`, `toMatch(`, `code:` or `.code ===`. Comments and test titles are removed first. The stricter check found four codes that were only mentioned, and each now has an assertion:
   - E1049: `packages/compiler/conformance/E1049-internal-failure-0065.test.ts` injects a failure through the public API (a source whose getter throws). It asserts `code: "E1049"`, the message `internal compiler failure: injected read failure` verbatim, and no `path` or `line`.
   - E1902: `forms/conformance/E1902-field-path-not-in-schema.test.ts` asserts `toThrow(/^E1902 /)` instead of a bare `toThrow()`.
   - E1801 and E1807: `ui/conformance/rules-e1801-e1807-codes-0065.test.ts` asserts the thrown code of `compileStyles` (a raw `p: "16px"`, a value that breaks out of CSS) and of `defineTokens` (a non-string token).

## Alternatives
- **Move the runtime codes out of Rules.** Rules is where each section names its codes, and `spec --for` and `explain` read it. Moving 36 codes would scatter them without making any of them checkable.
- **Keep a hand list of explain-only codes.** That is what drifted. `reportedCodes()` comes from the registry and the pipeline, and the test fails if a fixture triggers a code the list leaves out.
- **Report every `URL.createObjectURL` or every non-constant `import()`.** Object URLs back downloads and image previews, and apps build `import()` paths from data. Both would flag correct code.
- **Put the origin walk in the shared resolver.** The walk is E1603's question: the URL a value holds. The resolver answers a different question: which global a name denotes. E1002 and E1601 do not need the walk. The resolver only exposes binding identity (`sameBinding`), so names resolve one way.

## Spec diff
- **k.check.** Status becomes `conformance-covered`, here and in `spec/00-map.md`. The Codes paragraph changes as in Proposal 4. Conformance clause 1 becomes the text in Proposal 2.
- **k.ctx Rules.** "`new Worker`/`SharedWorker` of a `data:` or `blob:` URL" becomes "`new Worker`/`SharedWorker` (also `Reflect.construct`) of a `data:` or `blob:` URL". It adds "E1603 follows a URL through `String()`, templates, `+`, `new URL`, `?:`, object literal properties and each value assigned to a local, and a function's prototype chain to its `constructor`." "Neither follows values through calls, object literals, a reassigned binding, or another file" becomes "Neither follows values through calls or another file; E1601 also not through object literals or a reassigned binding". The reference becomes "(rfc:0053, 0058, 0061, 0065)".
- **k.ctx Conformance.** Adds "`import(String(URL.createObjectURL(b)))`, `` import(`${URL.createObjectURL(b)}`) ``, `new Worker(new URL(URL.createObjectURL(b)))`, `Reflect.construct(Worker, [URL.createObjectURL(b)])`, `import(u)` after `let u; u = URL.createObjectURL(b)`, and `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)` are each one E1603; `new Worker(new URL('./w.js', import.meta.url))` is not."
  - The clause does not start with a double-backtick span. `normClause` drops the backticks but keeps the padding space inside the span, so a header quote that starts with one never matches.

## Conformance diff
- **Rewritten** `packages/check/conformance/explain-and-fixture-per-code.test.ts`. It is now `test`, not `test.fails`, and quotes the amended clause. It checks that:
  - `reportedCodes()` is sorted and unique and lists every fixture's code;
  - every kernel E code in it has a fixture (E1756 aside);
  - E1756 comes from a registered rule that throws on `throws.ts`, and another file does not trigger it;
  - every Rules code outside `reportedCodes()` (36) is named by another package's conformance;
  - each code's `explain` is at most 120 tokens;
  - each fixture triggers exactly its code.
- **Changed** `fixtures-by-code.ts`: adds E1401, E1402, E1403, E1404 and E1804, and drops the "Codes not here are in EXPLAIN_ONLY" note.
- **Changed** `fixture-per-code.test.ts`: the `EXPLAIN_ONLY` list goes. The file asserts that E1451-E1454 have fixtures and that every fixture is for a code `check()` reports. The clean-counterpart loops stay.
- **Changed** `fix-diffs.test.ts`: its no-fix list gains E1402 (the content of the missing `Case` is the author's) and E1804 (the token pair is a design choice), so the fix and no-fix lists still partition the fixtured codes.
- **Added** `packages/check/conformance/string-code-origin-0065.test.ts` (k.ctx): the six forms are each one E1603, and the module worker URL is clean.
- **Mutation config.** `vitest.mutate.config.ts` runs `fixture-per-code.test.ts` again, since it no longer reads `spec/`. It excludes `explain-and-fixture-per-code.test.ts`, which reads `spec/` and `packages/*/conformance`. The `@keel/check` score is 73.3% (threshold 70%).
- **Unit test** `packages/check/test/e1603-origin-0177.test.ts`. 22 bad forms from the backlog are each one E1603, and all 22 gave `[]` before this RFC. 8 more bad forms and 16 more clean forms cover the edges of the walk. 9 clean forms stay clean, among them `new Worker(new URL('./w.js', import.meta.url))`, a blob URL assigned to `a.href`, `Object` two steps above a plain arrow, and `Object` three steps above an async arrow.

## Migration
- E1603 reports more forms. `apps/` has no E1603 finding (golden-1 68 files, golden-2 44, inspector 28).
- `reportedCodes()` is a new export. No existing API changes.

## Token impact
- k.check: about 1,220 tokens (chars/4), within the 1,500 limit. k.ctx: about 1,150. The map is unchanged in size.
- **Size budget.** `@keel/check` grows from 28,976 to 29,871 bytes gzip, inside its 30 kB (30,720 B) budget.
