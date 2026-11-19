# Server log `[secret]` reach: 0628 and 0642

## What holds today

- The sentence is in k.privacy Sinks, not k.server (k.server is 1,503 tokens and needs no change):
  "The revealed value of each `Secret` in the decoded action input is replaced by `[secret]` the same way."
- `runAction` adds `secretValues(decoded.value)` (`@keel/schema/internal`) to `rq.secrets`; `createApp` runs every diag's
  message and each of its `frames` through `redacted(text, rq)` (`[pii]` pass, then `[secret]` pass, `scrubbed`).
- `secretValues` gives strings and numbers and leaves out the empty string and booleans, by design (its doc).
- A `Secret` has one creation point: `Secret.of` in `packages/schema/src/Secret.ts`, reached by `seal` (every
  `s.secret(...).parse`, including `credentials(ctx).mint`, which does `SecretText.parse(text)`) and by `gen`.

## 0628 split

- Diag frame: (a), already right. `createApp` scrubs each frame; no test showed it. Added
  `packages/server/test/secretScrubReach.test.ts` "[secret] in a diag frame": a frame `modules/tok-7f3a9c/a.server.ts:3:7`
  logs as `modules/[secret]/a.server.ts:3:7`. Passes with no code change.
- Boolean secret: no defect. "The same way" as `piiValues`, which gives only strings and numbers, so a boolean is not
  marked. Marking one would cost every `true` / `false` in the record, or, marking only the actual value, show which
  it was by where the mark appears. A passing test pins this. The sentence below says so out loud.
- A `Secret` parsed elsewhere (a loader's parse, a token made after an `await`): (b). Two `test.fails` cases in the
  same file reproduce it (the value is logged as is).

## 0642: (b), same mechanism

`mint` makes its token with `s.secret(s.string()).parse`, so a record of "every `Secret` made while this request runs"
covers 0642 and 0628's "parsed elsewhere" with one mechanism. The kernel may not import `@keel/std-credentials`, and it
does not need to.

## Design

1. `@keel/schema/internal` gains `onSecret(listener: (value: unknown) => void): () => void`: one module-level
   listener slot (a second call replaces it; the return clears it). `Secret.of` calls it with the raw value after
   construction. No listener: one `undefined` check. Internal only; no public API, no k.schema sentence.
2. `@keel/server` holds one `AsyncLocalStorage<RequestScope>` (`node:async_hooks`), entered around `handle` in
   `createApp`'s `routed`. At `createApp` it installs `onSecret((v) => { const rq = als.getStore(); if (rq) for (const x
   of secretValues(v)) rq.secrets.add(x) })`, so any value from `secretValues` of the made secret (strings and numbers;
   nested secrets are made first and noted on their own) enters the request's existing `secrets` set. The action-input
   line in `runAction` stays (a decoded input secret is made by `seal` inside the request too, so it could go; keeping
   it costs nothing).
3. `scrubbed` keeps one rule for every value: a value under 3 characters only as a whole token. No second length rule
   (PRINCIPLES 1).

Costs: `@keel/schema` about +60 B gzip (budget 5.5 kB); `@keel/server` an ALS import and one `run` per request; the
per-request `secrets` set already exists (one entry per string or number secret made, a minted token is ~90 chars plus
its 3 encoded forms in the regexp). False scrubs: a short numeric secret (a PIN `7`) also marks a line or column `7`
in a frame (`a.ts:3:[secret]`) and a whole-token `7` in the message: readability only, nothing leaks. Runtime: ALS needs
`node:async_hooks` (Node, Bun, Deno, Workers with nodejs_compat); `@keel/server` is Node-only today.

## Spec diff (k.privacy, Sinks, Server log bullet)

Today: "The revealed value of each `Secret` in the decoded action input is replaced by `[secret]` the same way."

New: "The revealed value of each `Secret` made while the request runs (its decoded action input, a loader's parse, a
minted token) is replaced by `[secret]` the same way, a string or a number as `piiValues` gives one; a boolean is not
marked."

k.privacy: 1,374 tokens today, 1,407 after this sentence, about 1,452 with the conformance bullet below.

Conformance header quoting the changed sentence: `packages/server/conformance/privacy-diag-scrub.test.ts` (line 3).

New conformance bullet (k.privacy Conformance): "A loader that parses a `Secret` and throws its revealed value, and an
action that parses one after an `await` and throws it, each log a `diag` record holding `[secret]`; a boolean secret's
value is logged as is."

Cases for the writer:
- Route `/a` with a loader that does `await Promise.resolve(); const k = s.secret(s.string()).parse("api-key-91c2e7d40b");`
  then throws `new Error("upstream refused " + reveal(k.value))`; GET `/a` in production with a `log.write` collector:
  the `keel.unexpected` line is `loader app.a threw: Error: upstream refused [secret]` and no line holds `api-key-91c2e7d40b`.
- POST `/a` whose action awaits once, parses `"keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0"` with
  `s.secret(s.string())` and throws `Error("mailer down; token " + revealed)`: line `action app.a threw: Error: mailer
  down; token [secret]`, in dev and production; the dev JSON body does not hold the token either.
- Input `{ flag: s.secret(s.boolean()) }`, sent `{ flag: true }`, action throws `Error("flag " + String(reveal(flag)))`:
  line `action app.a threw: Error: flag true`.
- Two overlapping requests, each parsing its own secret after an `await`: each request's diag marks its own value and
  leaves the other request's value as written (the set is per request).

## The user's to decide

1. The hook shape: an internal `onSecret` listener in `@keel/schema/internal` plus ALS in `@keel/server` (recommended), or
   a per-request collector passed through `ctx` (no ALS, but every `parse` site would need the ctx).
2. Secrets made outside any request (a config key parsed at startup, a runner's job): mark them in every record from a
   process-wide set, capped (say 256), or leave them unmarked as today. Runner diags (`keepRunning` `failed`) have no
   scrub pass at all now; a run-scoped ALS store would give them one with the same hook.
3. Booleans stay unmarked (recommended), or mark both `true` and `false` whole-token when the request made a boolean
   secret.
4. A minimum length beyond the whole-token rule for short values: recommended none.

## Recommendation

Build the `onSecret` hook and the ALS request store as one rfc: it covers loader parses and minted tokens with the set
the scrub already reads, and adds no public API. Keep booleans unmarked and say so in the sentence.
