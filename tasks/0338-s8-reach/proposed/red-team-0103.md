# Red team: rfc:0103 `@keel/std-credentials` (429ab4c1..96a21322)

Probes ran as a temporary `packages/std-credentials/test/zz-probe.test.ts` over the conformance `fixtures.ts` helpers (now deleted). `sim` = `simCtx()`, `real` = `realCtx()`.

## Findings

### 1. medium: a stored hash at an `ln` other than the ctx's lists accounts by time
- Probe (real; `s14` = `$scrypt$ln=14,r=8,p=1$<salt>$<scryptSync key>`, `s17` = a real `hash`):
  ```ts
  for (const st of [undefined, s17, s14]) { const a = performance.now(); await rawVerify(real, secretOf("wrong pass"), st); log(performance.now() - a) }
  // unknown 170,171,166 ms · ln17 175,171,171 · ln14 20,20,20
  const r18 = await ctxWithLn(realCtx(), 18)  // the documented upgrade
  // unknown 509,435,481 ms · stored ln17 200,200,199
  ```
- Expected: THREAT-MODEL **Credentials** "An unknown account costs one derivation, so timing does not list accounts"; RFC Example 1 "the same answer in about the same time as a wrong password".
- Actual: the unknown-account derivation runs at the ctx's `ln`; a known account derives at its stored `ln` (and `p`). Every account not yet rehashed (an imported `ln=14` hash the conformance supports, or every account after an app raises `ln` 17 to 18, the path D3 documents) answers in a fraction of an unknown email's time, until that user signs in. Not in Known limits.
- Smallest fix: when `was.ln < ln` (or `p` differs), pad the known-account path to one derivation at the ctx's cost (run the dummy derivation too, or derive the stored key then a ctx-cost dummy); or state the window in the threat model and Known limits.

### 2. low: lone surrogates collide; `verify` is `ok` for a secret that was not hashed
- Probe (sim; real is the same code path in `inputOf`):
  ```ts
  const h = await credentials(sim).hash(secretOf("pass\uD800word"))
  await credentials(sim).verify(secretOf("pass\uDBFFword"), h.value) // {ok:true, rehash:false}
  await credentials(sim).verify(secretOf("pass�word"), h.value) // {ok:true, rehash:false}
  ```
- Expected: std.credentials "`verify` is `ok` only when the secret matches `stored`"; "The input is its text, NFKC-normalized, as UTF-8" (a lone surrogate has no UTF-8 form). JSON input `"\ud800"` parses to one.
- Actual: `Buffer.from(text, "utf8")` maps every lone surrogate to U+FFFD.
- Smallest fix: in `inputOf`, `if (!text.isWellFormed()) return null` (so `credentials.length` from `hash`, `credentials.mismatch` from `verify`), and say so in the spec's input bullet.

### 3. low: `check` throws
- Probe:
  ```ts
  rawCheck(sim, tok, () => null)                                          // THREW TypeError: reading 'digest'
  rawCheck(sim, tok, () => { throw new Error("db down") })                // THREW Error: db down
  rawCheck(sim, tok, () => ({ get digest() { throw new Error("g") } }))   // THREW
  ```
- Expected: std.tokens "Both are synchronous and neither throws"; README "No method throws".
- Actual: `row === undefined` lets `null` through to `row.digest`; `find` and the getter run unguarded. `null` is what a nullable db lookup or `Map`-backed helper returns; types alone stop it.
- Smallest fix: `if (row === undefined || row === null || typeof row !== "object") return MISMATCH`; and either catch around `find` (answer `MISMATCH`) or make the spec say "neither throws, except what `find` throws".

### 4. low: `verify(secret, null)` answers at once with `credentials.malformed`
- Probe: `rawVerify(sim, secretOf("x"), null)` gives `credentials.malformed` `format`, 0 ms under real (finding 1's harness: `malformed 0,0,0`).
- Expected: "`stored` `undefined` (no such account) derives one key and is `credentials.mismatch`"; THREAT-MODEL "timing does not list accounts".
- Actual: an app whose row has `password: null` (an SSO-only or invited account, or `user?.password ?? null`) gets a distinct code with no derivation, so those accounts are listed by code and time. Past the types (`Hashed | undefined`), so low.
- Smallest fix: treat `stored === null` as `undefined` in `verify`.

### 5. low: cost fixed at a ctx's first use, before `createApp` binds `std`
- Probe:
  ```ts
  const c = createCtx({ mode: "sim", seed: 1 }); credentials(c)
  bindStd(c, { "@keel/std-credentials": { accounts: { ln: 19 } } })
  await credentials(c).hash(secretOf("abc")) // $scrypt-sim$ln=17,...
  ```
- Expected: THREAT-MODEL "at N = 2^17 ... or a higher N the app's `std` config sets"; spec "A ctx's cost is the highest `ln` any module sets".
- Actual: the `WeakMap` keeps the `ln` 17 Hasher for the ctx's life; never below 17, but below the configured cost. Reachable only by a call before `createApp` (module top level, a startup hook).
- Smallest fix: build the Hasher only once `stdBindings` has the ctx, or re-read `costOf` when the binding changes (key the cache on ctx and `ln`).

### 6. low: a fractional sim clock makes `mint` answer `credentials.ttl` for a valid `ttl`
- Probe: `const s2 = simCtx(); s2.clock.advance(0.5); credentials(s2).mint({ ttl: 60000 })` gives `credentials.ttl`.
- Expected: std.tokens "`ttl` ... an integer from 60,000 to 31,536,000,000 ... any other value is `credentials.ttl`".
- Actual: `exp=60000.5` fails `Digested`'s `[a-z0-9=,]`, and the parse failure is answered as `TTL`. Sim only (`Date.now()` is an integer).
- Smallest fix: `Math.floor(now())` for `expiresAt` (or `Math.ceil`, to never extend a token).

### 7. low: E2201 misses a dynamic `import()` and `require`; E2202 misses a helper outside `modules/` and an unparseable topology
- Probe (`check([...], { types: false })`, static topology `{ web: { modules: ["a"], adapter: "static" } }`):
  - `modules/a/x.ts`: `export const f = () => import("@keel/std-credentials/server")`: no E2201 (only E1752). The same for `createRequire(import.meta.url)("@keel/std-credentials/server")`.
  - `lib/creds.server.ts` re-exporting `credentials`, imported by `modules/a/x.server.ts`: no E2202 for module `a` (served by `static`).
  - `topology.ts` `const t = { web: { modules: ["a"], adapter: "static" } }; export default topology(t)` plus a module server file importing the entry: no E2202 and no topology finding at all from `check`.
  - module id `test`: `modules/test/x.ts` importing the entry has no E2201 (`TEST_PATH` matches `test/` anywhere in the path).
- Expected: std.credentials Rules "E2201 `@keel/std-credentials/server` imported outside a `*.server.ts` file" · "E2202 that import in a module a deployable other than `node` serves".
- Smallest fix: count `ImportExpression` with that literal source in `serverImports`; anchor `TEST_PATH` to the path after `modules/<id>/`; for E2202 either follow a relative import out of the module one level or say in the spec that the rule reads the module's own files only.

### 8. low (docs): "A process runs 2 derivations at once"
- Expected: THREAT-MODEL **Credentials**.
- Actual: the bound is per ctx (`WeakMap<Ctx, Hasher>`, one `gate` each) and 1 at `ln` 19 and 20. The dev server builds one ctx per deployable in one process (`devEntryCode.ts`), so a dev process with k node deployables runs 2k at once (128 MiB each). In production one ctx per process holds, so the memory claim stands there.
- Smallest fix: "Each server runs at most 2 derivations at once (1 at `ln` 19 and 20) ...".

## What held
- `readHashed`: `$v=` mark, wrong part count, `ln`/`r`/`p` with leading zeros or out of range, salt/key byte bounds, non-canonical base64 (decodes, spends a derivation, `exact` false, `mismatch`), non-string `stored` (`format`), 256-char cap.
- Sim form under real and shell (`malformed` `sim`, before any derivation); `Hashed` and `Digested` generators are always `-sim`; real-form under sim verifies; ln 14 legacy verifies with `rehash` true; an `ln` above the ctx's never rehashes downward; `ln` below 17 not reachable through config (E1158 at bind).
- `check`: the clock is read only after a match; `expired` only after `timingSafeEqual` and the sim/real mark agree; sim token under real is `mismatch` without `find`; edited digest, non-canonical digest, `exp` text, wrong id, another row's digest all `mismatch` or `malformed`; a row that is a string is `malformed` `format`.
- Errors: every constant (`MISMATCH`, `EXPIRED`, `LENGTH`, `TTL`, `malformed(*)`, `busy(limit)`) is frozen at result, error and data; keys `code`, `message`, `data` only; no secret, token or stored text in any.
- Queue: `release` in `finally` passes or frees the slot after a failed or throwing derivation; FIFO, no starvation; `keel.busy` is reached the same way for known and unknown accounts.
- Empty and over-long passwords answer `mismatch` at once for known and unknown accounts alike.
- E1112 around a minted token in a `*.server.ts` file: 25 of 27 shapes into `tx`, `console.log` and `throw` (aliases, destructuring, templates, arrays, `?:`, `&&`, `||`, `??`, `split`, `slice`, `join`, `for…of`, `String(...)`, `e.message =`) are one E1112 each. The two misses (`new TextEncoder().encode(...)`, `await Promise.resolve(...)`) are E1112's documented "another call ends it", not this package's.
- E2201 via a `*.server.ts` re-export imported from a plain file: E1004 reports the import. A deep `dist/` path is not resolvable through the package `exports`.
