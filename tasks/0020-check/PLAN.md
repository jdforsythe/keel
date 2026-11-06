# Task 0020: check (covers 0020 and 0021)

**Spec:** k.check (+ rules from k.errors, k.ctx, k.ui, k.schema, k.store, k.testing) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/check

## Deliverables
- [x] 0020 pipeline: oxc parse, strict TS check (in-memory host), compiler pass-through, rule registry, project passes, rendered a11y, dedupe/sort
- [x] 0020 diagnostic model, `format` (compact/json/pretty per docs/OUTPUT.md), `explain` for every kernel E code
- [x] 0021 rule registry (`defineRule`, `rules`, E1753/E1756), budgets (E1755), git-applicable fix diffs (E1451, E1452, E1601, E1805; compiler E1401 passes through)
- [x] kernel rules: E1005, E1104, E1302, E1451, E1452, E1453, E1454, E1601, E1701, E1751, E1752, E1753, E1754, E1755, E1756, E1802, E1803, E1805
- [x] property tests (seed 1337): format caps/grouping/order/dedupe/json counts; diff round-trip via git apply; token budget on 10 injected errors; rule fixtures
- [x] README contract; `.changeset/check-initial.md`; spec status left `proposed` (owner flips after review)

## Steps
1. [x] Conformance suite present (packages/check/conformance, read-only).
2. [x] Implement; `tsc`/biome/structure-lint clean for check sources; conformance green except the two listed below.
3. [x] Properties, rule tests, README, changeset.

## Decisions
- D1: `check(files, opts)` is pure over in-memory `{ path, source }[]`; `opts.root` (default cwd) only feeds module resolution for the TS step. `types: false` / `render: false` skip steps 1b / 4.
- D2 (JSX typing superseded by D22): TS step = `ts.createProgram` over an in-memory host with the tsconfig.base.json strict profile, `jsx: preserve` and a virtual global `JSX` namespace (`Element = Node`, children via `children`, intrinsics open), since `@keel/runtime-dom/jsx-runtime` does not exist. Lib/disk SourceFiles cached; previous program reused; results memoized by input (LRU 128).
- D3: Component props: in a `.tsx` declaring `Props`, the checker sees `: Infer<typeof Props>` on each untyped component props param (inserted, offsets mapped back; alias appended at EOF). Without `Props`, implicit `any` on component props (TS7006/7031) is not reported.
- D4: TS -> Keel mapping: missing a11y prop on a base element (by `Property 'x' is missing`, or 2322/2739/2741/2769 at the tag name) -> E1802; missing `key` on `For` -> E1001; `not assignable to type 'Href'` -> E1501; children-thunk mismatch on If/Boundary/Case/Match (compiler lowers JSX children to thunks) dropped; everything else E1751 `TS<code> <first line>`. A mapped code the compiler already reported in that file is dropped (compiler is authoritative).
- D5 (superseded by D17): E1805 is held back on files with compiler diagnostics, and `<a>` with a literal absolute `href` (http(s), mailto, tel) is exempt: `Link` takes only an `Href` from `href()`, k.compiler admits absolute URLs. Needed so k.check "fixture triggers exactly that code" holds for the compiler fixtures (they use intrinsics). Spec tension k.ui E1805 vs k.compiler examples: candidate RFC.
- D6: E1601 applies to app and test code (architecture skill: no bare Date/Math.random/fetch in app or test code); fixes only where the ctx form is exact (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`, `fetch`, `localStorage.getItem/setItem`).
- D7: App code = code file not under test/tests/conformance/__tests__, not `*.test.*`/`*.spec.*`, not under unsafe/, .keel/, node_modules/, not `*.config.*`. Test code = the test half of that.
- D8: E1752: unique export names (type + value of one name count once); a `.tsx`/`.jsx` with a default export may also export `Props`; `index.*` exempt; anonymous default exempt from the name check; stem = basename up to the first dot.
- D9: E1453 lives in the TS step (needs types): expression statement whose (awaited) type is a union with `ok` on every member and `value`/`error` members; `void expr` is the explicit discard.
- D10: E1454 and E1753 (source) are project passes over app files in path order (later declaration reported). `defineRule` itself throws `E1753 ...` for duplicates and for codes outside E2xxx/W2xxx; kernel rules register internally.
- D11: `RuleDef.message` may be a function of the finding (kernel rules name what they found); messages are clipped to 89 chars. `fix` returns edits or `null`; rendered with an LCS line diff, `--- a/` `+++ b/` headers, multi-hunk, `\ No newline` markers.
- D12 (trailer superseded by D19): Compact: groups sorted by code, rows sorted by path/line/col, cap 5 or `limit`, `... +N more <code> (keel check --code <code>)`; fix shown as `-`/`+` lines only, or `fix: N-line patch (keel check --format=json --code X)` above 6 lines (token budget); `see` omitted (via `explain`). Trailer `ok|fail check: E errors, W warnings (CODE=n, ...)` (`=` so `--quiet`/`--code` output never contains `CODE `); `(1.2s)` only when `ms` is passed. json: canonical key order (byte-identical to `{kind:'diag', ...compilerDiag}`), uncapped unless `limit`, summary `{ kind, ok, errors, warnings, infos, counts }` (+`ms`).
- D13: `FormatOptions.mode` typed `string` (conformance passes widened strings); unknown values render compact.
- D14 (ctx part superseded by D20): Rendered check (step 4): compiled output -> `ts.transpileModule` to CJS -> evaluated with a kernel module map (reactive, runtime-dom, ops, schema, store, ui) -> `mount` into a happy-dom tree (ambient `document` if present, else a temporary happy-dom window on globalThis) -> structural a11y (img alt; input/textarea/select label; button and a[href] name) -> E1802 at the default export. Only files with no E diagnostics so far and only kernel imports; render throws are ignored. No sim ctx yet: `@keel/testing` is later in deps order and ctx injection into components is unspecified.
- D15: E1755 takes caller-measured budgets `{ id, limit, actual, unit, path? }` (check does not measure sizes itself).
- D16: unsafe count 1: `unsafe/loadComponent.ts` (`new Function` over compiled module text, default export typed as a component). `unsafe/unsafe.ts` re-created (an earlier factory commit removed it as unused).

- D17 (review): E1805 fires on every lowercase intrinsic in app code: no hold-back, no `<a>` exemption. The message always names a base element (`Link`, `Image`, `Input`, ... ; `Box` when nothing closer); the fix rewrites drop-ins (div/span/button, Box/Text `as` tags, b/i -> Text strong/em, h1-h6 -> Heading level) when the element has no attributes besides `id`. A literal `javascript:`/`data:` string where an `Href` is required maps to E1003 (base elements route URLs through `Href`), so the compiler's E1003 dedupes it.
- D18 (review): TS step caches on-disk SourceFiles (node_modules, workspace sources, TS libs) by path + mtime across calls; the result memo records every disk file the program read with its mtime and is reused only while all still match. One `createProgram` per call (oldProgram reuse kept). New/removed files that change module resolution are not tracked.
- D19 (review): Trailer per OUTPUT.md: `ok 0 errors, 0 warnings` / `fail 3 errors, 1 warning`, `(1.8s)` only when `ms` is passed; the line carries no codes. Per-code counts follow on a second, two-space-indented line (`  E1003 2, E1401 1`) when non-empty: omitted under `quiet`, only the selected code under `code` (indented so no line starts with a code). json summary unchanged.
- D20 (review): The rendered check mounts with `createCtx({ mode: 'sim', seed: 1337 })` from `@keel/ctx` via `mount(component, el, { ctx, onError })` (runtime-dom passes it as the component's third argument); a render caught by the root Boundary reports nothing. `@keel/ctx` joins the evaluation module map. `loadComponent` returns a runtime-dom `Component`.
- D21 (review): E1752 exempts a `*.server.ts` whose exports are only `loader`/`action` (k.server). E1005 is a project pass over `.keel/<name>.json` files among the checked files: the file must be `canonicalJson({ data, hash })` + newline with `hash === hashOf(data)` and, when `opts.artifacts.hashes[name]` is given (the compiler's `hashes`), equal to it. Message "hand edit to generated .keel/<name>; revert and regenerate". A diff fix is attached only when data and hash are intact (bytes differ); otherwise regeneration is the only correct fix, so no diff. `canonicalJson`/`hashOf` are copied from the compiler's internals (it does not export them; candidate export).
- D22 (review): JSX types: new `packages/runtime-dom/jsx-runtime.d.ts` (`exports["./jsx-runtime"]` types-only, in `files`; README line; changeset `runtime-dom-jsx-runtime.md`): `Element = Node`, `ElementChildrenAttribute { children }`, `IntrinsicElements` tag -> attributes (`on*`: handler; others string/number/boolean/null/Node/arrays). The TS step resolves `@keel/runtime-dom/jsx-runtime` from `root` and sets `jsxImportSource`; the virtual global shim is only the fallback when it does not resolve. `annotateProps` stays: components written `function C(props)` are untyped at the authoring site, and without it `For` infers its item from `key` and `i.name` fails (verified: E1001 fixture then reports E1751).

## Open / for review
- `explain` reads a spec-derived table (`src/internal/EXPLANATIONS.ts`); a generator from spec Rules lines would keep it in sync.
- E1005 duplicates the compiler's `canonicalJson`/`hashOf`; exporting them from `@keel/compiler` would remove the copy.
- Earlier conformance issues (fc.shuffle; Button children) are resolved upstream (fixtures rewritten; RFC 0008 children as `props.children`).

## Verification
- [x] conformance green (rewritten fixtures + E1805 suite) · package tests green · properties present (seed 1337)
- [x] `pnpm --filter @keel/check check` (tsc + biome) clean · structure-lint clean
- Mutation: `mutate` is `echo skip`; not measured.

Test trailer (`pnpm --filter @keel/check test`): `ok 102 tests, 0 failed, 4 skipped (3.5s)`

## Next action
review
