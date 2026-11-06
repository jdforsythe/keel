# Task 0010-0013: compiler

**Spec:** k.compiler, k.component · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/compiler
Covers backlog 0010 (oxc plugin, JSX to DOM ops, If/For/Match), 0011 (artifacts, escaping by context), 0013 (component props, slots, ids, E14xx) as one package build.

## Deliverables
- [x] `compile(files, { mode })` -> `{ outputs, artifacts, hashes, diagnostics }`, pure and deterministic
- [x] JSX lowering: hoisted templates, one binding per dynamic expression, components as getter props, intrinsics to cond/list/match/boundary
- [x] artifacts: deps.json, ids.json, routes.json (empty), a11y.json; sorted keys; content hash each
- [x] diagnostics E1001-E1004, E1401-E1404 (E1401 with fix hunk)
- [x] `@keel/compiler/testing` evaluate; `@keel/compiler/vite` plugin (minimal, untested)
- [x] property tests (seed 1337); README contract; changeset (spec status: coordinator flips after review)

## Steps
1. [x] conformance written by conformance-writer (packages/compiler/conformance, uncommitted in tree).
2. [x] Implement; `pnpm --filter @keel/compiler check`; `test` (conformance green; tsc blocked by render-purity type, see Verification).
3. [x] Properties (test/properties.test.ts) and examples (test/lowering.test.ts); README; `.changeset/compiler-initial.md`; spec status left `proposed` pending review (coordinator).

## Decisions
- D1: Parse with `oxc-parser` `parseSync(path, source, { sourceType: 'module', lang })` (lang from extension); walk with oxc's typed `Visitor` (no casts needed; unsafe count stays at the one eval site). Rewrite with `magic-string`: only outermost JSX ranges, E1401 edits, intrinsic-only `@keel/runtime-dom` imports, and a prepended header change; TS is preserved byte for byte.
- D2: `compile(files, { mode })` is pure: returns `{ outputs, artifacts, hashes, diagnostics }`; outputs in input order; artifacts built with sorted keys; `hashes[name] = "fnv1a:" + FNV-1a(canonical JSON)` (in-house, no crypto). Diagnostics sorted by path, line, col, code. The Vite plugin (`@keel/compiler/vite`) writes `.keel/<name>` as `{ data, hash }`, chmod 0444.
- D3: Generated code imports `* as __k from "@keel/runtime-dom/ops"` (namespace grows `_` until absent from the source); templates hoisted as `const __kt<i> = __k.template(html)` after the import. One template per element root; a fully static root compiles to just `__k.clone(__kt<i>)`.
- D4: Node references inside a cloned root: elements by `root.querySelector('[id="<id>"]')` (every element has an id; robust to parser-inserted nodes such as tbody); text/anchor children by `parent.childNodes[i]`. All refs are taken before any op runs. Dynamic text child = one-space text placeholder; adjacent text nodes separated by `<!---->`; components and control flow get a `<!---->` anchor (`replaceWith(Component(...))` for components, op anchor for If/For/Match/Boundary).
- D5: Element ids: literal `id` kept; otherwise `<file>.<ordinal>` (`<file>` per D19) where the ordinal counts every intrinsic element of the file in source order from 0 (explicit ids also consume an ordinal, so adding an id never renames siblings). Derived ids are written into the template. E1404 checks across all files of one compile.
- D6 (amended by D17): Op signatures (from packages/runtime-dom/src/ops): `cond(anchor, when, then)`, `list(anchor, each, key: item => k, render(item: () => T, index: () => number))`, `match(anchor, on, key, cases: { [tag]: (value: () => U) => Node })`, `boundary(anchor, children, fallback)`. Users write row/case callbacks with plain values (`(item) => item.name`, per conformance); the compiler rewrites reads of identifier params to accessor calls (`item()`), or wraps destructured params once.
- D7: Match discriminant: explicit `key="..."` on Match, else the `Props` schema union key (static `s.union(key, [...])` resolution), else `state` if all Case tags are resource states, else `tag`.
- D8 (amended by D20): E1401 simple patterns (`{ a, b: c }`, no defaults/rest/nesting) are rewritten in the output to `props.a` reads; the same edits form the fix.
- D9: `mode: "server"` currently emits the client module. Server HTML rendering (escaping, `data-k`, `<!--[-->` regions, using runtime-dom `internal/safeUrl`) is not built: follow-up.
- D10 (superseded): `mode` is back to `"client" | "server"` after the rfc:0000 conformance fix typed `constantFrom`.
- D11: Parse errors are reported as `E1000 syntax error: ...` and the file is passed through unlowered. E1000 is not in the spec code table: needs a spec line (RFC).
- D12: E1501 (k.router) implemented compiler-side for literal URL attributes that are neither absolute (`scheme:`/`//`) nor a `#fragment`. E1003 literals are replaced with `about:blank` in the template.
- D13: a11y.json: role = explicit `role` else implicit role by tag (input by type); name source = `aria` (aria-label/labelledby) > `alt` > `label` (ancestor label or `for`) > `text` (only for name-from-content roles) > `none`.
- D14: deps.json nodes: signal/computed/resource declarations, effect calls, props fields, bindings (text/attr/prop/on and the tracked input of cond/list/match); edges by identifier name within a file; `on` bindings have no edges.
- D16: Children the HTML parser would restructure inside one template (`p > div`, `table > tr`, `a > a`, headings in headings, non-option in select, ...) are cloned from their own template and inserted with `replaceWith` (`internal/canNest.ts`), so the DOM always equals the JSX tree and `childNodes` indices hold.
- D17: Row/case parameter rewrite is scope-aware. `analyze` records every declaration with its scope (function, block, for, switch, catch, program; `var` to the function) and `bindsTo` resolves a read to its innermost declaring scope; only reads that resolve to the callback's own parameter are rewritten. Destructured (or defaulted) parameters become an accessor `x` plus a trailing default parameter `p = (<pattern>) => ({ names })` (padded past the index slot); each read of a bound name becomes `p(x()).name`, so rows and cases stay live when the item for a key changes. E1401's rewrite uses the same resolver.
- D18: Artifact maps are null-prototype objects filled via `Object.hasOwn`/Maps (ids, a11y, canonical JSON, merge); internal lookup tables are Maps, so ids or tags such as `constructor`/`__proto__` are kept and never resolve to prototype members.
- D19 (spec decision, k.component IDs line updated): derived ids use `<file>` = project-root-relative path without extension with `/` as `.` (`src/orders/OrderList.tsx` -> `src.orders.OrderList.0`); `compile` paths are taken as root-relative (`./` and `\` normalized). Removes false E1404 between `a/index.tsx` and `b/index.tsx`. Spec question for freeze: inserting an element shifts the ordinal of every later derived id in the file (accepted for now).
- D20: E1401 fix is a real unified patch: `--- a/<path>`, `+++ b/<path>`, one `@@ -l,c +l,c @@` hunk per changed line range with up to 3 context lines (hunks whose context would overlap merge, as diff does), `\ No newline at end of file` markers. Tested with `git apply --check` and `git apply` in a temp dir under test/.
- D21: Vite plugin compiles only the changed module (cached by source), merges per-module artifacts (`internal/mergeArtifacts`; cross-module duplicate ids fail the later module with E1404), evicts modules on `watchChange` delete, skips a write when the serialized artifact is unchanged, and writes temp + chmod 0444 + rename. Quadratic passes removed: identifier filtering uses a sorted-span coverage index; `record`/`select`/`owner` use binary search over sorted idents/JSX/edits/elements; rules index identifiers by name once. (`componentAt` remains a linear scan per binding.)
- D22: Any `on*` attribute on an element, in any case (`onclick`, `onClick`), is an event binding; a string or bare value (`onclick="..."`) is never emitted and reports E1002 (code from a string). `./testing` is dev-only: `esbuild` is an optional peer dependency (also a devDependency); `happy-dom` stays a devDependency (tests supply the DOM).
- D15: `evaluate` (test helper) runs esbuild `transformSync(loader: 'ts', format: 'cjs')` then `new Function` inside a never-disposed root `scope` (module-level signals would otherwise be E1203). The `new Function` lives in `unsafe/runCommonJs.ts` (unsafe count 1).

## Verification
- [x] conformance green (17 files; keel-dir-tamper skipped by design) · properties present · biome clean · structure-lint clean for compiler · docs-freshness, budgets, generate ok
- [x] `pnpm --filter @keel/compiler check` green (tsc + biome) after review fixes D17-D22.
- Mutation: `mutate` script is `echo skip`; not measured.
- Open: server-mode HTML renderer (D9); E1000 needs a spec line (D11); E1004 client-only exemption needs the topology input; runtime-dom intrinsic types for `For`/`Case` children declare accessors (`item: () => T`) while compiler conformance writes plain values (D6): runtime types should say `(item: T, index: number) => Node`.

Test trailer (`pnpm --filter @keel/compiler test`): `ok 55 tests, 0 failed, 1 skipped (1.4s)`

## Next action
review
