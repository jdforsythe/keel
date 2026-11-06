# Task 0010-0013: compiler

**Spec:** k.compiler, k.component · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/compiler
Covers backlog 0010 (oxc plugin, JSX to DOM ops, If/For/Match), 0011 (artifacts, escaping by context), 0013 (component props, slots, ids, E14xx) as one package build.

## Deliverables
- [x] `compile(files, { mode })` -> `{ outputs, artifacts, hashes, diagnostics }`, pure and deterministic
- [x] JSX lowering: hoisted templates, one binding per dynamic expression, components as getter props, intrinsics to cond/list/match/boundary
- [x] artifacts: deps.json, ids.json, routes.json (empty), a11y.json; sorted keys; content hash each
- [x] diagnostics E1001-E1004, E1401-E1404 (E1401 with fix hunk)
- [x] `@keel/compiler/testing` evaluate; `@keel/compiler/vite` plugin (minimal, untested)
- [x] property tests (seed 1337); README contract; changeset; spec status -> implemented

## Steps
1. [x] conformance written by conformance-writer (packages/compiler/conformance, uncommitted in tree).
2. [x] Implement; `pnpm --filter @keel/compiler check`; `test` (conformance green; tsc blocked by render-purity type, see Verification).
3. [x] Properties (test/properties.test.ts) and examples (test/lowering.test.ts); README; `.changeset/compiler-initial.md`; k.compiler and k.component status -> implemented (spec files and map rows).

## Decisions
- D1: Parse with `oxc-parser` `parseSync(path, source, { sourceType: 'module', lang })` (lang from extension); walk with oxc's typed `Visitor` (no casts needed; unsafe count stays at the one eval site). Rewrite with `magic-string`: only outermost JSX ranges, E1401 edits, intrinsic-only `@keel/runtime-dom` imports, and a prepended header change; TS is preserved byte for byte.
- D2: `compile(files, { mode })` is pure: returns `{ outputs, artifacts, hashes, diagnostics }`; outputs in input order; artifacts built with sorted keys; `hashes[name] = "fnv1a:" + FNV-1a(canonical JSON)` (in-house, no crypto). Diagnostics sorted by path, line, col, code. The Vite plugin (`@keel/compiler/vite`) writes `.keel/<name>` as `{ data, hash }`, chmod 0444.
- D3: Generated code imports `* as __k from "@keel/runtime-dom/ops"` (namespace grows `_` until absent from the source); templates hoisted as `const __kt<i> = __k.template(html)` after the import. One template per element root; a fully static root compiles to just `__k.clone(__kt<i>)`.
- D4: Node references inside a cloned root: elements by `root.querySelector('[id="<id>"]')` (every element has an id; robust to parser-inserted nodes such as tbody); text/anchor children by `parent.childNodes[i]`. All refs are taken before any op runs. Dynamic text child = one-space text placeholder; adjacent text nodes separated by `<!---->`; components and control flow get a `<!---->` anchor (`replaceWith(Component(...))` for components, op anchor for If/For/Match/Boundary).
- D5: Element ids: literal `id` kept; otherwise `<file stem>.<ordinal>` where the ordinal counts every intrinsic element of the file in source order from 0 (explicit ids also consume an ordinal, so adding an id never renames siblings). Derived ids are written into the template. E1404 checks across all files of one compile.
- D6: Op signatures (from packages/runtime-dom/src/ops): `cond(anchor, when, then)`, `list(anchor, each, key: item => k, render(item: () => T, index: () => number))`, `match(anchor, on, key, cases: { [tag]: (value: () => U) => Node })`, `boundary(anchor, children, fallback)`. Users write row/case callbacks with plain values (`(item) => item.name`, per conformance); the compiler rewrites reads of identifier params to accessor calls (`item()`), or wraps destructured params once.
- D7: Match discriminant: explicit `key="..."` on Match, else the `Props` schema union key (static `s.union(key, [...])` resolution), else `state` if all Case tags are resource states, else `tag`.
- D8: E1401 simple patterns (`{ a, b: c }`, no defaults/rest/nesting) are rewritten in the output to `props.a` reads; the same edits form the fix, rendered as `-old`/`+new` lines (no `@@` header, as in OUTPUT.md). Shadowing is not resolved (best effort).
- D9: `mode: "server"` currently emits the client module. Server HTML rendering (escaping, `data-k`, `<!--[-->` regions, using runtime-dom `internal/safeUrl`) is not built: follow-up.
- D10: `CompileOptions.mode` typed `string` (conformance passes `fc.constantFrom("client","server")`, which widens to `string`).
- D11: Parse errors are reported as `E1000 syntax error: ...` and the file is passed through unlowered. E1000 is not in the spec code table: needs a spec line (RFC).
- D12: E1501 (k.router) implemented compiler-side for literal URL attributes that are neither absolute (`scheme:`/`//`) nor a `#fragment`. E1003 literals are replaced with `about:blank` in the template.
- D13: a11y.json: role = explicit `role` else implicit role by tag (input by type); name source = `aria` (aria-label/labelledby) > `alt` > `label` (ancestor label or `for`) > `text` (only for name-from-content roles) > `none`.
- D14: deps.json nodes: signal/computed/resource declarations, effect calls, props fields, bindings (text/attr/prop/on and the tracked input of cond/list/match); edges by identifier name within a file; `on` bindings have no edges.
- D16: Children the HTML parser would restructure inside one template (`p > div`, `table > tr`, `a > a`, headings in headings, non-option in select, ...) are cloned from their own template and inserted with `replaceWith` (`internal/canNest.ts`), so the DOM always equals the JSX tree and `childNodes` indices hold.
- D15: `evaluate` (test helper) runs esbuild `transformSync(loader: 'ts', format: 'cjs')` then `new Function` inside a never-disposed root `scope` (module-level signals would otherwise be E1203). The `new Function` lives in `unsafe/runCommonJs.ts` (unsafe count 1).

## Verification
- [x] conformance green (17 files; keel-dir-tamper skipped by design) · properties present · biome clean · structure-lint clean for compiler · docs-freshness, budgets, generate ok
- [ ] `tsc --noEmit` red on one line outside this package's control: conformance/render-purity.test.ts:21 calls `Card(props)` but `Mountable = Parameters<typeof mount>[0]` is runtime-dom's `Component = () => Node`. Needs runtime-dom's `Component` to accept an optional props argument, or an rfc:0000 conformance fix.
- Mutation: `mutate` script is `echo skip`; not measured.
- Open: server-mode HTML renderer (D9); E1000 needs a spec line (D11); E1004 client-only exemption needs the topology input; runtime-dom intrinsic types for `For`/`Case` children declare accessors (`item: () => T`) while compiler conformance writes plain values (D6): runtime types should say `(item: T, index: number) => Node`.

Test trailer (`pnpm --filter @keel/compiler test`): `ok 43 tests, 0 failed, 1 skipped (1.0s)`

## Next action
review
