# std-credentials 0644 and 0649: both (b), two spec sentences, no code

Section `std.credentials` is 1,388 tokens today (5,550 chars); both sentences together make it 1,478 (5,912 chars, limit 1,500).

## 0644: `credentials(ctx)` throws E1158

Established. `credentials(ctx)` reads `costOf(ctx)` -> `stdConfig(ctx, pkg, CredentialsConfig)`, which parses each bound value and throws E1158. A bad value reaches a bound ctx only when `bindStd` could not check it: `bindStd` validates against the schema registered under the package name, and `@keel/std-credentials` registers it when `CredentialsConfig` loads (importing `/server`). A bind that runs before that import (a lazy `import()` of the server entry, an entry that binds first) passes any value; k.module says "packages that registered none are validated when read". Every other path is checked earlier: `keel check`, `keel build` (E1158 before `std.json` is written), `createApp({ std })` after the package loaded, and a hand-edited file (E1160). Reproduced in `packages/std-credentials/test/bindOrder.test.ts` (`test.fails`: bind `ln: 99`, then import the server entry, then `credentials(ctx)` throws; the twin bound after the import throws at bind).

Why a throw is right: it is a deployment fault, not a per-call outcome. A Result (`hash`/`verify` answering a new `credentials.config` error) adds a code and a branch every caller must write for a state it cannot repair, and a `mismatch` would hide it. It is also the same E1158 that bind raises for the same value one step earlier.

Change (spec, API section, last bullet). Today: "- Each error is one constant per code, `reason` and `limit`: none holds a part of the secret or of `stored`, and nothing throws."
After: "- Each error is one constant per code, `reason` and `limit`: none holds a part of the secret or of `stored`, and no call throws. `credentials(ctx)` throws E1158 (k.module) for a ctx bound, before this package loaded, to a std config that fails its schema."
Conformance headers quoting the changed sentence: `conformance/errors.test.ts` lines 1 and 113 (the quote is the whole bullet; the writer re-quotes it).
Cases wanted: (1) `bindStd(ctx, { "@keel/std-credentials": { a: { ln: 99 } } })` before any import of `@keel/std-credentials/server` (fresh module registry), then `credentials(ctx)` throws an error with `code` E1158 whose message names `ln`; (2) the same bind after the import throws E1158 at `bindStd`; (3) `ln: 18` bound before the import: `credentials(ctx).hash(...)` writes `ln=18`, nothing throws.
Code: none.

## 0649: E2201 and E2202 reach

E2201 and `createRequire(...)("@keel/std-credentials/server")`. The Rules sentence names static imports and `import()`; `require` is not covered, so widening is (b). Real hit: very unlikely. A client bundle cannot contain it (bundlers do not resolve a `createRequire` call), so it is a Node-only file, which is where the entry is allowed anyway except in a non-`*.server.ts` server helper. Cost: a `CallExpression` walk with callee `createRequire(...)` is about 250 bytes; the `./tools` entry is 1,242 of 1,280 bytes. Does not fit. Recommend a stated limit.

E2202 and a helper outside `modules/`. Following a relative import is new behaviour, (b). Real hit: a module of a `client` or `static` deployable importing `lib/creds.server.ts`. Plausible but the same helper imported from a plain module file is already E1004 (a `*.server.ts` import from a non-server file), and a `*.server.ts` file in a module that no node deployable serves has no runtime. A resolver (relative path, extension, index files) is well beyond the byte room. Recommend a stated limit.

Change (spec, Rules). Today: "E2201 `@keel/std-credentials/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix) · E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix)."
After: the same, then: " Each rule reads the file's own `import`, `export ... from` and `import()` declarations: a `require`, and a helper file that re-exports the entry, are not followed."
Conformance headers quoting the changed sentence: `conformance/rules.test.ts` lines 1 and 2 (the E2202 quote ends at "(no fix)."; the writer keeps it as is, the added sentence is new).
Cases wanted: (1) `modules/a/x.ts` calling `createRequire(import.meta.url)("@keel/std-credentials/server")`: no E2201; (2) `lib/creds.server.ts` re-exporting `credentials`, `modules/a/x.server.ts` importing it, module `a` in a `static` deployable: no E2202.
Code: none. Reproducing tests (`test.fails`, which flip if the rules ever follow): `packages/std-credentials/test/reach.test.ts`; delete them if the limit is accepted, or the writer pins the "no finding" cases above.

## User's to decide
Whether the E2201/E2202 limit sentence is acceptable or the rules should reach (needs a bytes budget raise for `./tools`).

## Recommendation
0644: state the throw (sentence above). 0649: state the limit (sentence above); both rules stay as they are.
