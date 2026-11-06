# @keel/compiler

**Spec:** k.compiler + k.component · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `compile(files, { mode? })` -> `{ outputs, artifacts, hashes, diagnostics }`. `@keel/compiler/vite`: default export `keel()` Vite plugin, no options; compiles each changed module, merges artifacts, writes `.keel/{a11y,deps,ids,routes}.json` as read-only `{ data, hash }` atomically and only on change. `@keel/compiler/testing` (dev-only; needs the optional peer `esbuild` and a DOM environment): `evaluate(code)` runs one output in-process, returns its default export.
- **Output:** JSX lowers to `@keel/runtime-dom/ops`: one hoisted `template(html)` per element root, cloned once per render; each dynamic expression is exactly one `text`/`attr`/`prop`/`on` binding; `<Foo a={x}>` is `Foo({ get a() { return x } }, { default })`; `If`/`For`/`Match`/`Boundary` lower to `cond`/`list`/`match`/`boundary` at a comment anchor. Row and case callbacks take plain values; reads become accessor calls (scope-aware; destructured params re-destructure per read). Any-case `on*` attributes are event bindings. TypeScript outside JSX is kept byte for byte.
- **Ids:** literal `id` kept, else `<path>.<ordinal>`: root-relative path without extension, `/` as `.` (`src.orders.OrderList.0`), ordinal over the file's elements in source order; written into the template.
- **Invariants:** pure and deterministic (sorted keys, FNV-1a hash per artifact, no clock, no fs); static text and attributes are HTML-escaped at compile time; literal `javascript:`/`data:` URLs become `about:blank`; elements the HTML parser would restructure (`p > div`, `table > tr`) get their own template.
- **Diagnostics:** E1001 E1002 (also inline `on*` handler strings) E1003 E1004 (k.compiler), E1401 (fix is a `git apply`-able unified patch; simple patterns rewritten) E1402 E1403 E1404 (k.component), E1501 for literal string paths (k.router), E1000 syntax error (pending spec line).
- **Dependencies:** oxc-parser, magic-string; runtime-dom, reactive, schema, store (evaluate); esbuild (optional peer, evaluate only).
- **Rungs:** conformance (example + probabilistic), property tests (determinism, ids, XSS).

## Not yet

`mode: "server"` emits the client module (no server HTML renderer); E1005 is k.check's; E1004 has no client-only exemption yet; `routes.json` is `{}` until k.router.

## Unsafe

count: 1 — `unsafe/runCommonJs.ts`: `new Function` to run compile output in-process (test helper `evaluate` only).
