# Task 0020: check (covers 0020 and 0021)

**Spec:** k.check (+ rules from k.errors, k.ctx, k.ui, k.schema, k.store, k.testing) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/check

## Deliverables
- [x] 0020 pipeline: oxc parse, strict TS check (in-memory host), compiler pass-through, rule registry, project passes, rendered a11y, dedupe/sort
- [x] 0020 diagnostic model, `format` (compact/json/pretty per docs/OUTPUT.md), `explain` for every kernel E code
- [x] 0021 rule registry (`defineRule`, `rules`, E1753/E1756), budgets (E1755), git-applicable fix diffs (E1451, E1452, E1601, E1805; compiler E1401 passes through)
- [x] kernel rules: E1104, E1302, E1451, E1452, E1453, E1454, E1601, E1701, E1751, E1752, E1753, E1754, E1755, E1756, E1802, E1803, E1805
- [x] property tests (seed 1337): format caps/grouping/order/dedupe/json counts; diff round-trip via git apply; token budget on 10 injected errors; rule fixtures
- [x] README contract; `.changeset/check-initial.md`; spec status left `proposed` (owner flips after review)

## Steps
1. [x] Conformance suite present (packages/check/conformance, read-only).
2. [x] Implement; `tsc`/biome/structure-lint clean for check sources; conformance green except the two listed below.
3. [x] Properties, rule tests, README, changeset.

## Decisions
- D1: `check(files, opts)` is pure over in-memory `{ path, source }[]`; `opts.root` (default cwd) only feeds module resolution for the TS step. `types: false` / `render: false` skip steps 1b / 4.
- D2: TS step = `ts.createProgram` over an in-memory host with the tsconfig.base.json strict profile, `jsx: preserve` and a virtual global `JSX` namespace (`Element = Node`, children via `children`, intrinsics open), since `@keel/runtime-dom/jsx-runtime` does not exist. Lib/disk SourceFiles cached; previous program reused; results memoized by input (LRU 128).
- D3: Component props: in a `.tsx` declaring `Props`, the checker sees `: Infer<typeof Props>` on each untyped component props param (inserted, offsets mapped back; alias appended at EOF). Without `Props`, implicit `any` on component props (TS7006/7031) is not reported.
- D4: TS -> Keel mapping: missing a11y prop on a base element (by `Property 'x' is missing`, or 2322/2739/2741/2769 at the tag name) -> E1802; missing `key` on `For` -> E1001; `not assignable to type 'Href'` -> E1501; children-thunk mismatch on If/Boundary/Case/Match (compiler lowers JSX children to thunks) dropped; everything else E1751 `TS<code> <first line>`. A mapped code the compiler already reported in that file is dropped (compiler is authoritative).
- D5: E1805 is held back on files with compiler diagnostics, and `<a>` with a literal absolute `href` (http(s), mailto, tel) is exempt: `Link` takes only an `Href` from `href()`, k.compiler admits absolute URLs. Needed so k.check "fixture triggers exactly that code" holds for the compiler fixtures (they use intrinsics). Spec tension k.ui E1805 vs k.compiler examples: candidate RFC.
- D6: E1601 applies to app and test code (architecture skill: no bare Date/Math.random/fetch in app or test code); fixes only where the ctx form is exact (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`, `fetch`, `localStorage.getItem/setItem`).
- D7: App code = code file not under test/tests/conformance/__tests__, not `*.test.*`/`*.spec.*`, not under unsafe/, .keel/, node_modules/, not `*.config.*`. Test code = the test half of that.
- D8: E1752: unique export names (type + value of one name count once); a `.tsx`/`.jsx` with a default export may also export `Props`; `index.*` exempt; anonymous default exempt from the name check; stem = basename up to the first dot.
- D9: E1453 lives in the TS step (needs types): expression statement whose (awaited) type is a union with `ok` on every member and `value`/`error` members; `void expr` is the explicit discard.
- D10: E1454 and E1753 (source) are project passes over app files in path order (later declaration reported). `defineRule` itself throws `E1753 ...` for duplicates and for codes outside E2xxx/W2xxx; kernel rules register internally.
- D11: `RuleDef.message` may be a function of the finding (kernel rules name what they found); messages are clipped to 89 chars. `fix` returns edits or `null`; rendered with an LCS line diff, `--- a/` `+++ b/` headers, multi-hunk, `\ No newline` markers.
- D12: Compact: groups sorted by code, rows sorted by path/line/col, cap 5 or `limit`, `... +N more <code> (keel check --code <code>)`; fix shown as `-`/`+` lines only, or `fix: N-line patch (keel check --format=json --code X)` above 6 lines (token budget); `see` omitted (via `explain`). Trailer `ok|fail check: E errors, W warnings (CODE=n, ...)` (`=` so `--quiet`/`--code` output never contains `CODE `); `(1.2s)` only when `ms` is passed. json: canonical key order (byte-identical to `{kind:'diag', ...compilerDiag}`), uncapped unless `limit`, summary `{ kind, ok, errors, warnings, infos, counts }` (+`ms`).
- D13: `FormatOptions.mode` typed `string` (conformance passes widened strings); unknown values render compact.
- D14: Rendered check (step 4): compiled output -> `ts.transpileModule` to CJS -> evaluated with a kernel module map (reactive, runtime-dom, ops, schema, store, ui) -> `mount` into a happy-dom tree (ambient `document` if present, else a temporary happy-dom window on globalThis) -> structural a11y (img alt; input/textarea/select label; button and a[href] name) -> E1802 at the default export. Only files with no E diagnostics so far and only kernel imports; render throws are ignored. No sim ctx yet: `@keel/testing` is later in deps order and ctx injection into components is unspecified.
- D15: E1755 takes caller-measured budgets `{ id, limit, actual, unit, path? }` (check does not measure sizes itself).
- D16: unsafe count 1: `unsafe/loadComponent.ts` (`new Function` over compiled module text, default export typed as a component). `unsafe/unsafe.ts` re-created (an earlier factory commit removed it as unused).

## Open / for review
- Conformance `compact-grouping.test.ts` "sorted by path, line, col" uses `fc.shuffle`, which fast-check 3.23.2 does not export: fails at runtime and breaks `tsc --noEmit` (so `pnpm --filter @keel/check check` is red on that file only). Suggest `fc.shuffledSubarray(xs, { minLength: 5, maxLength: 5 })`. Not edited (rfc only).
- Conformance `rendered-a11y.test.ts` "rendered once ... adds no diagnostics" fails for a cross-package reason: the compiler lowers `<Button>Go</Button>` to `Button({}, { default: () => ... })` (children as a slot), while `@keel/ui` reads `props.children`, so the rendered button has no name and step 4 reports E1802. The check is faithful; fix belongs in compiler or ui (k.component slots vs k.ui `children`), likely an RFC.
- E1752 vs `*.server.ts` modules exporting both `loader` and `action` (k.server): currently reported; confirm the intended shape.
- E1005 (hand edit of `.keel/`) is listed in k.compiler conformance as a `keel check` report; not implemented here (not in this task's rule list).
- `explain` reads a spec-derived table (`src/internal/EXPLANATIONS.ts`); a generator from spec Rules lines would keep it in sync.

## Verification
- [ ] conformance green: 58 passed, 2 failed (both listed above), 4 skipped (untestable notes file); package tests (test/) 34 passed
- [x] properties present (seed 1337) · biome clean on src/test/unsafe · structure-lint clean for check
- [ ] `pnpm --filter @keel/check check`: tsc red only on conformance/compact-grouping.test.ts (fc.shuffle)
- Mutation: `mutate` is `echo skip`; not measured.

Test trailer (`pnpm --filter @keel/check test`): `fail 98 tests, 2 failed, 4 skipped (3.3s)`

## Next action
review
