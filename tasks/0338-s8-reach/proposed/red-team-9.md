# Red team 9: identity seam, server boundary, tokens (RFC 0139 k.user + k.mount, RFC 0140 k.boundary, RFC 0141 std.tokens; head 3ca5e477)

Build probes used the `k.boundary` conformance fixture (`packages/cli/conformance/boundary-support.ts`: `materialize(nodeTree("node"))` plus one changed file, `viteBuild(dir, "api")` or `keelRun(dir, ["build"])`), with `TMPDIR` set to a session scratch dir, one build at a time, each fixture removed afterwards. "Leaked" means the canary `K_SECRET_feedc0ffee1234567890` was found in a file under `dist/` other than `server.mjs`/`server.mjs.map`. The probe script was `scratchpad/rt9-scripts/probe.ts` (cases quoted below); unit probes called `callerSigner`, `tokensOf` and `identityMount` from source with `node` (type stripping). "Ran" means the output quoted was observed; "reasoned" means it was read from the code only.

Counts: HIGH 3 · MEDIUM 4 · LOW 6.

## HIGH

### H1. A Web Worker's bundle carries a server-only file whole; `vite build` and `keel build` both pass (ran)
Fixture: `lib/notes.server.ts` = `export const notes = '<canary>'`; `lib/w.ts` = `import { notes } from './notes.server.ts'; postMessage(notes)`; in `modules/a/Page.tsx`: `new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })`.
Observed: `vite build` (KEEL_DEPLOYABLE=api) exit 0, no E1007, canary in `dist/api/assets/w-<hash>.js`. `keel build` exit 0, same leak. The `?worker` form (`import W from './w.ts?worker'`) leaks the same way under `vite build`. With `w.ts` under `modules/a/`, `keel build` stops at E1004 (w.ts is client-reachable by placement) but `vite build` still leaks.
Cause: Vite builds workers in a separate bundle whose plugins come from `worker.plugins`, not `plugins`, so the keel plugin's stub `load` and its `buildEnd` E1007 walk never run there; `clientReach` does not follow `new URL(…, import.meta.url)`.
Expected: k.boundary Server-only "no byte of a server-only file … is in an asset served to a browser"; Assertion "its graph from any entry, dynamic imports and emitted files included".
Fix: set `worker.plugins: () => [keel-boundary-subset]` (stub `load` + `buildEnd` breach walk) in the plugin's `config`, or have the client build's `buildEnd` walk each emitted worker chunk; make E1004 Reach follow `new Worker(new URL(<literal>, import.meta.url))` and `?worker`/`?sharedworker` specifiers.

### H2. A `*.server.json` (any non-JS `*.server.*`) ships into the browser; `keel build` passes (ran)
Fixture: `modules/a/keys.server.json` = `{ "key": "<canary>" }`; `Page.tsx`: `import k from './keys.server.json'`.
Observed: `vite build` exit 0, `keel build` exit 0; canary in `dist/api/assets/entry-<hash>.js`; no E1004, no E1007.
Cause: `SERVER_NAME` in `packages/compiler/src/vite.ts:66` is `/\.(?:server|guard)\.[cm]?[jt]sx?$/` (JS/TS only); the check's reach uses the same narrow shape. The same holds for `x.server.txt?raw`, `x.server.md?raw`.
Expected: k.boundary Server-only "A server-only file is a file named `*.server.*` or `*.guard.*`" and "no byte of a server-only file … is in an asset".
Fix: either widen `SERVER_NAME` to `/\.(?:server|guard)\.[^/]+$/` in the plugin, `clientReach` and E1004 (a JSON stub has no named exports: refuse it with E1007 instead of stubbing), or narrow the spec to "`*.server.<js|ts>`" and add E1004 for any non-code `*.server.*` import.

### H3. A plain-file loader through a namespace import passes E1551 and E1007; its body ships (ran)
Fixture: `modules/a/load.ts` = `import * as R from '@keel/router'; … export const load = R.loader({ output: Out }, async () => ok({ title: '<canary>' }))`; `routes.ts` imports `load` from `./load.ts`.
Observed: `vite build` exit 0 and `keel build` exit 0, canary in `dist/api/assets/entry-<hash>.js`; no E1551, no E1007.
Cause: `callsHandler` (`packages/compiler/src/internal/callsHandler.ts`) only matches `import { loader [as x] } from "@keel/router"` followed by `x(`; E1551 (`check/src/rules/loaderInServerFile.ts`) only matches an `Identifier` callee from `localNames`. `R.loader(…)` (MemberExpression) and a re-export through an app file (`lib/r.ts`: `export { loader } from '@keel/router'`) both miss. The same reasoning applies to `action` and to E1009 `guard`.
Expected: k.boundary Assertion "a file calling `loader`, `action` or `guard` from `@keel/router`"; k.server E1551.
Fix: resolve handler calls on the AST in both places: a namespace import's member (`R.loader`), and refuse (E1551/E1009) a re-export of `loader`/`action`/`guard` from app code; drive the plugin's `handlers` set from the same oxc pass instead of the regex.

## MEDIUM

### M1. `vite build` on a case-insensitive file system ships a server-only file imported with different case (ran)
Fixture: `modules/a/notes.server.ts` holds the canary; `Page.tsx`: `import { notes } from './notes.Server.ts'`.
Observed on macOS: `vite build` exit 0, no E1007, canary in `dist/api/assets/entry-<hash>.js`. `keel build` stops only by accident of the type check (E1751 TS1261 "Already included file name … differs only in casing").
Expected: k.boundary Build gate "`vite build` alone runs no check; the stubs and E1007 still hold."
Fix: in `load`/`breach`, test `SERVER_NAME` (case-insensitive) on `fs.realpathSync.native(id)`, which returns the on-disk case.

### M2. A project `envPrefix` array survives the plugin's lock; `import.meta.env.KEEL_*` is inlined (ran under `vite build`)
Fixture: `vite.config.ts` `defineConfig({ envPrefix: ["KEEL_"], plugins: [keel()] })`; `Page.tsx` reads `import.meta.env.KEEL_TEST_VALUE`; build env `KEEL_TEST_VALUE=<canary>`.
Observed: exit 0, canary in `dist/api/assets/entry-<hash>.js`. With `envPrefix: "KEEL_"` (a string) nothing leaks: Vite's `mergeConfig` concatenates arrays, so the plugin's `"\0"` is appended instead of replacing. My `keel build` attempt stopped at an unrelated type error (the fixture's ambient `ImportMeta` declaration was not seen by the check); a project with typed env would build.
Expected: k.boundary Environment "A browser build's `import.meta.env` holds only `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL`, exposing no variable by prefix"; Limits name only `define`.
Fix: set the prefix in `configResolved` (or assert in `configResolved` that `config.envPrefix` is exactly `["\0"]` and throw E1007-like otherwise), or add `envPrefix` beside `define` in k.boundary Limits.

### M3. A signed `x-keel-user` authorizes any body, on any host sharing the secret, any number of times for 60 s (ran on `callerSigner`)
Probe: `k = await callerSigner("x".repeat(32))`; `h = k.assert("POST", "http://b.keel.invalid/b/x?q=1", "u1", now)`; `k.user(new Request("https://other-host.example/b/x?q=1", { method: "POST", headers: { "x-keel-user": h }, body: '{"amount":999999}' }), now + 59_000)` → `"u1"`. Another path → rejected; `now + 61_000` → rejected (held).
Also: a sender whose clock runs ahead mints an assertion the receiver accepts until that far-future expiry (`k.assert(…, now + 1 year)` verifies at `now`): the receiver has no upper bound on `expiry - now`.
Peers may be plain `http` (E1565 accepts http origins), so anyone on the path between deployables can replay a write as that user with a body of their choosing within the window. The spec signs "method, path, search, `user` and an expiry 60 s ahead": the code matches k.user, so this is a design gap.
Fix: add the body's SHA-256 (or `""` for none) and the target origin to the MAC input; reject `expiry > now + 60_000 + skew` (e.g. 5 s); state in k.user that peer traffic should be https and that the header is replayable within its window, or record nonces for writes.

### M4. The ledger still reports the deleted `@keel/std-credentials` exports as verified, and has no `std-tokens` row (reasoned from the tree)
`tooling/ledger/ledger.json:10162-10180` lists `CredentialsConfig`, `Digested`, `Hashed` under `pkg: "std-credentials"` at `packages/std-credentials/src/*.ts` (`rung: "probabilistic"`); `tooling/ledger/evidence.json:2515` counts `std-credentials` 3/3 verified. `packages/std-credentials` no longer exists; `ledger.json` has 0 `std-tokens` entries. Head 3ca5e477 is "chore: evidence data and coverage after the tokens rename", so the regeneration ran but did not drop or rename these rows, and no gate failed.
Principle 11: "Claims lag machinery. The ledger reports only rungs that exist."
Fix: make the ledger generator drop items whose `file` is missing and fail `pnpm check` (ledger lint) on a `file` that does not exist; regenerate.

## LOW

- L1. E1579 compares literal prefixes only (`compiler/src/hosting/identityDiags.ts:33`, `createApp.ts:149`), so a param route that matches the mount (`/api/:svc/:act` vs `handle.path` `/api/auth`) is not reported (reasoned). In a client router, `Link to={mount.href('/sign-out')}` then matches that page and is handled client-side, never reaching the library (k.mount Navigation: "A router handles client-side only a path its table matches as a page"); a `Form` to it posts through the router. The user sees a page and stays signed in. Fix: E1579 also when `matchUrl(table, handle.path + '/x')` or `handle.path` itself matches a route.
- L2. `identityMount(path)` does not validate `path` at runtime (ran): `identityMount('/\\evil.example').href()` is `/\evil.example`, which a browser resolves to `https://evil.example/`; `'/\t/evil.example'` with `href('/x')` resolves to `https://evil.example/x`. E1580 (check) and `createApp`'s E1579 regex both refuse such a path, so a `keel build` app is safe; a `vite build`-only project or a test using `identityMount` directly is not. Fix: throw E1580 in `identityMount` when `path` fails `/^(\/[a-z0-9-]+)+$/`.
- L3. `handle.path` may be `/assets` (regex `/^(\/[a-z0-9-]+)+$/` allows it), and the mount is dispatched before `servedEntry` (`internal/handle.ts:52-59`), so the library shadows every built asset (reasoned). Fix: E1579 for a `handle.path` at or under `/assets` (and any path the built entry serves).
- L4. `tokens(ctx).check` throws (`TypeError: Cannot read private member #value`) for a plain-string or `undefined` token instead of answering `credentials.mismatch` (ran); `Tokens.type.ts` says "No method throws". A JS caller or an untyped header value reaches it. An async `find` (a Promise row) answers `credentials.malformed` `format` for every token, which reads as corrupt storage, not as misuse (ran). Fix: `textOf` returns `""` for a non-Secret (then MISMATCH); a thenable row → MISMATCH plus a dev warning, or type `find` to refuse a Promise at compile time.
- L5. `check` accepts an expired token when `ctx.clock.now()` is `NaN` (`now() >= want.expiresAt` is false; ran: `clockNaN: "ok"`). Not reachable with the real clock; reachable with a faked or broken one. Fix: `if (want.expiresAt !== null && !(now() < want.expiresAt)) return EXPIRED`.
- L6. `x-keel-user` carries a `user` of any length and content (newline included; ran: `"a\nb"` verified), while `identify` answers are capped at 256 characters (k.user Identity source). A peer receives a `user` no `identify` could give. Fix: `assert`/`buildRequest` refuse a `user` over 256 characters (`api.input`), and `keys.user` ignores one.

## Principles
- Principle 11, "The ledger reports only rungs that exist.": M4.
- Principle 2, "Nothing outside a file changes what that file does.": k.boundary D1 states the opposite on purpose: "the meaning is read from `topology.ts`, never from the file". A `*.server.ts` import is a stub or the real code depending on another file. RFC 0140 argues the trade; it is not recorded as an exception to principle 2 anywhere (`docs/PRINCIPLES.md` unchanged, ADR-0162 does not cite principle 2). Suggest the ADR names it.
- Principle 4, "Closed vocabularies wherever a string would do.": `@keel/std-tokens` answers `credentials.*` codes (RFC 0141 Open question 1); a vocabulary named after a package that no longer exists.
- Stale advice against the RFC 0141 direction: `.changeset/check-revealed-value.md:5` still says "store a derived value such as a salted `scrypt` hash" (the E1112 explanation was updated; this changeset was not).

## Probes that held
- Stubs: plain `./x.server.ts` import, `export *` barrel (`modules/a/index.ts` re-exporting `notes.server.ts`), `import.meta.glob('./notes.*.ts', { eager: true })`, a computed `import(\`./${n}.server.ts\`)` (dynamic-import-vars): no leak.
- E1007 fired for `?raw` via `import.meta.glob(…, { query: '?raw' })`, `?url&no-inline`, and `@keel/std-tokens/server` imported by a page (reason `node built-in`, chain through `@keel/std-tokens/src/server/internal/realEngine.ts -> node:crypto`).
- `new URL('./notes.server.ts', import.meta.url)` in a page: build passes, no canary emitted.
- `import './x.server.css'`: the build fails (esbuild cannot place the CSS), so nothing ships.
- A shared util with a top-level side effect ships (`lib/shared.ts`): stated in k.boundary Limits, not a finding.
- `keel build` runs `checkCommand` before any write and stops on every error but E1005; no flag, env value or suppression comment skips it (`check` has no ignore mechanism). Loaders in `unsafe/` or `*.config.ts` files escape E1551 (`isAppPath`) but are caught by E1007 `handler` when imported by name.
- `x-keel-user`: changed path, 61 s later and an unsigned value are ignored; the caller-cookie MAC and the user MAC share a key but cannot be swapped (a claim contains newlines, a caller token cannot); with no `secret` each process signs under 32 random bytes, so split peers fall back to their own `identify`; `secret: ""` is refused by E1556. `bindModules` gives the signer only to module targets.
- `identify`: a sync throw, an async throw, a `name` getter that throws, a non-string (`new String('x')`), > 256 characters and a never-settling promise all fail the request before guards (`userOf`; reasoned, matches the conformance).
- `mount.href`: `//x`, `/../x`, `/a/..`, `?`, `#`, `%`, `\`, a scheme all throw E1582; search keys and values are `encodeURIComponent`-encoded (`__proto__` included); `href` with path `/` and a subpath gives `//…`, which the `rooted` check refuses.
- Tokens: every malformed digest shape tried (number, null, object, array, 200-char, 17-digit `exp`, negative `exp`, extra parameter, `=` padding, empty digest, non-ASCII, `String` object) answers `credentials.malformed` without throwing; expiry is exact (`ttl` 60,000: ok at +59,999, `credentials.expired` at +60,000); no package, spec, skill or app source still hashes a password (only the RFC 0141 migration notes describe the old `$scrypt$` form).
- Timing: a missing row and a wrong digest both hash the presented token before answering; `malformed` depends only on stored data, not on the presented token.

## Proposed backlog lines
- [ ] 0886 red-team, high: a Web Worker (`new Worker(new URL(…))`, `?worker`) bundle carries a server-only file whole; worker builds get no stubs and no E1007, E1004 does not follow `new URL` · compiler · k.boundary · repro: red-team-9.md H1
- [ ] 0887 red-team, high: a `*.server.json` (any non-JS `*.server.*`) ships into the browser; `SERVER_NAME` covers JS/TS only · compiler, check · k.boundary · repro: red-team-9.md H2
- [ ] 0888 red-team, high: `R.loader(…)` through `import * as R from '@keel/router'` (or a re-export) passes E1551 and E1007; the loader body ships · compiler, check · k.boundary, k.server · repro: red-team-9.md H3
- [ ] 0889 red-team, medium: `vite build` on a case-insensitive FS ships `./notes.Server.ts`; test the real on-disk name · compiler · k.boundary · repro: red-team-9.md M1
- [ ] 0890 red-team, medium: a project `envPrefix` array survives the plugin's `"\0"` lock (mergeConfig concatenates); `import.meta.env.KEEL_*` is inlined · compiler · k.boundary · repro: red-team-9.md M2
- [ ] 0891 red-team, medium: `x-keel-user` is not bound to body or origin and the receiver has no expiry ceiling; a captured header replays any write for 60 s · server, services · k.user · repro: red-team-9.md M3
- [ ] 0892 red-team, medium: ledger and evidence list deleted `std-credentials` exports (`Hashed`, `CredentialsConfig`) as verified and have no `std-tokens` rows; no gate catches a ledger item whose file is gone · tooling · principle 11 · repro: red-team-9.md M4
- [ ] 0893 red-team, low: E1579 misses a param route matching `handle.path`; the client router swallows mount links · compiler, server · k.user, k.mount · repro: red-team-9.md L1
- [ ] 0894 red-team, low: `identityMount` does not validate `path` at runtime (`/\evil.example` resolves off-origin) · router · k.mount · repro: red-team-9.md L2
- [ ] 0895 red-team, low: `handle.path` `/assets` shadows built assets; E1579 allows it · server, compiler · k.user · repro: red-team-9.md L3
- [ ] 0896 red-team, low: `tokens.check` throws on a non-Secret token and answers `malformed` for an async `find` · std-tokens · std.tokens · repro: red-team-9.md L4
- [ ] 0897 red-team, low: `tokens.check` accepts an expired token when the clock reads `NaN` · std-tokens · std.tokens · repro: red-team-9.md L5
- [ ] 0898 red-team, low: `x-keel-user` carries a `user` of any length or content; cap at identify's 256 · services, server · k.user · repro: red-team-9.md L6
