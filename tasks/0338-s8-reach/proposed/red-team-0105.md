# Red team: RFC 0105 (log scrub reach) and the RFC 0104 red-team fixes

Range `de6be29f..316494a1`. Each probe ran as `packages/server/test/zz-probe.test.ts` (deleted), with the `boot`/`actionApp` helpers built as in `test/redTeam0104.test.ts` (sim ctx seed 1337, `artifacts: "/keel-probe-root/.keel"`, json log into `lines`).

## Findings

### 1. high: a secret with a lone surrogate makes the scrub throw, so the request's diag is dropped (and a live stream's goes to the console)
Probe:
```ts
const input = s.object({ k: s.secret(s.string()) });
// action: async () => { throw new Error("boom db down") }
await app.fetch(post('{"k":"ab\\ud800cd"}'));            // any client can send this JSON
// live loader: K.parse("x\ud800yz"); throw new Error("sur ...")
```
Expected: the server README, "An uncaught throw in an action, loader or runner is one `keel.unexpected` `diag`"; `liveStream`'s doc and red-team-0104 fix 1, "A throw of `fn` ends it with one `data:` line, its `keel.unexpected` `err`, and a `keel.unexpected` diag", nothing on the console.
Actual: `scrubbed` calls `encodeURIComponent(v)`, which throws `URIError: URI malformed` on a lone surrogate. Action (dev and production): no `diag` line at all, only `req … status 500`; the dev body is `URIError: URI malformed`. Live loader: no `diag`, no `err` line, and `console.error` prints `URIError: URI malformed`. A client that puts a lone surrogate in any secret (or `.pii()`) input field hides every diag its request causes. If `redacted` throws in `routed` after `handle` (the diag map), `routed()` rejects outside `attempt` and Hono answers its own 500 with no `req` line.
Fix: in `scrubbed`, `encodeURIComponent(v.toWellFormed())` (or skip the URI form when `!v.isWellFormed()`); the as-written form still matches the lone surrogate. Add the case to `privacy-diag-scrub`.

### 2. medium: a `Secret` holding an object or array marks none of its strings
Probe:
```ts
const Cfg = s.secret(s.object({ id: s.string(), key: s.string() }));
const Keys = s.secret(s.array(s.string()));
// action, after an await:
const c = Cfg.parse({ id: "client-1", key: "objkey-55aa77cc" }), k = Keys.parse(["arrkey-0f0f0f0f"]);
throw new Error(`refused ${reveal(c.value).key} ${reveal(k.value)[0]}`);
```
Expected: THREAT-MODEL Secrets, "the server writes `[secret]` in its log in place of each secret a request makes"; README, "`[secret]` in place of the revealed value of each `Secret` made while the request runs".
Actual: `action app.a threw: Error: refused objkey-55aa77cc arrkey-0f0f0f0f`. `secretValues` walks into a secret's object value only to find nested `Secret`s; plain strings and numbers inside are skipped. k.privacy's "a string or a number" can be read to exclude this; the threat model and README cannot, and RFC 0105 Known limits does not name it.
Fix: in `secretValues`, once inside a `Secret`, collect every string and number under it (a `walk` flag `inside`), keeping booleans out. Or state the limit in k.privacy Sinks and the threat model.

### 3. medium: a secret route param is written raw in the `req` line
Probe:
```ts
"app.r": { path: "/r/:token", params: s.object({ token: s.secret(s.string()) }), loader: loader({ output: s.object({}) }, async () => { throw new Error("reset failed") }), component: page }
await app.fetch(new Request("http://localhost/r/resettoken-abc123def", { headers: { accept: "text/html" } }));
```
Expected: THREAT-MODEL Secrets, "the server writes `[secret]` in its log in place of each secret a request makes".
Actual: `{"kind":"req",…,"path":"/r/resettoken-abc123def",…}`. The param is a `Secret` made in the request (it is in the set), but only `diag` records are scrubbed; `req.path` never is. k.privacy URLs refuses a `.pii()` param (E1111) but not an `s.secret` one, and a reset or invite link is the common case.
Fix: either scrub `path` in `reqLine` with `redacted(path, rq)` (the set is in reach in `routed`), or make an `s.secret` node in `params`/`search` E1111 as `.pii()` is, and say in the threat model that only `diag` records are scrubbed.

### 4. low: the pii pass runs first and splits a secret, so its other parts are logged; two overlapping secrets leave a tail
Probe:
```ts
input s.object({ k: s.secret(s.string()), name: s.string().pii("name") }), sent { k: "abcd-XYZW-9876", name: "XYZW" }, throw Error(`k ${reveal(k)}`)
// → "Error: k abcd-[pii]-9876"
input { a: secret "aaaa-bbbb", b: secret "bbbb-cccc" }, throw Error("joined aaaa-bbbb-cccc")
// → "Error: joined [secret]-cccc"
```
Expected: k.privacy Sinks, the revealed value of each `Secret` replaced by `[secret]`.
Actual: 10 of 14 secret characters stay in the first; `-cccc`, part of secret b, in the second.
Fix: in `redacted`, run the secret pass before the pii pass, and merge overlapping matches (mark the union of every form's match ranges rather than one leftmost-longest `replace`).

### 5. low: the matcher is rebuilt per frame and per pass; a bulk-secret input stalls the event loop
Probe: input `s.object({ keys: s.array(s.secret(s.string())) })`, 20,000 keys of 30 characters (a 660 KB body), action throwing an `Error` with 8 app frames → that one `fetch` takes 739 ms, synchronously. Node alone: an alternation of 100,000 tokens takes 1,950 ms to build and run once.
Expected: RFC 0105 Risks, "builds a large expression for each `diag`; the cost is paid only when a record is written".
Actual: `redacted` is called once for the message, once per frame and once in `scrubbedCause`, each building two regular expressions (pii, secret), so the cost is about 2 × (frames + 2) builds per record, all on the event loop, and the set is client-sized wherever an input holds an array of secrets.
Fix: build the secret and pii matchers once per request when the first diag is scrubbed (cache on `rq`, invalidated when the set grows), and cap the set (say 1,024 values; past it, mark the diag message as a whole `[secret]`).

### 6. low: a number secret of 3 or more digits is marked inside longer numbers and in line numbers
Probe: input `{ n: s.secret(s.number()) }`, sent `{ n: 500 }`, action throws `Error("upstream 1500 refused; retry 500ms at a.ts:500:3")` → `upstream 1[secret] refused; retry [secret]ms at a.ts:[secret]:3`.
Expected: RFC 0105 Risks says the mark "does not appear inside longer numbers", for the whole-token rule under 3 characters only.
Actual: from 3 digits up a number secret is marked inside other numbers, which shows where it stood and garbles the record.
Fix: apply the whole-token boundary to every all-digit value, whatever its length.

### 7. low: one stray `onSecret` call switches off every app's scrub for the life of the process
Probe: after `createApp`, `const off = onSecret(() => undefined); off();` then a second `createApp` → both apps log `Error: k slot-secret-123` / `…456` unmarked.
Expected: README, "`[secret]` in place of the revealed value of each `Secret` made while the request runs".
Actual: the slot holds one listener, `off()` clears it, and `noteRequestSecrets`' `noting` flag keeps any later `createApp` from installing it again. E1576 stops app code from importing `@keel/schema/internal`, but any file under `packages/` or `node_modules/` (a std package, a test helper) can do it, and nothing reports it.
Fix: have `noteRequestSecrets` check `listening.current === itsListener` (or `onSecret` return whether it replaced one) instead of a boolean, and make `onSecret` throw if the slot already holds a different listener.

### 8. low: a live stream's set grows for as long as the stream is open
By the code: `liveStream` spreads `r.rq`, so a stream keeps the request's `secrets` set, and the hook adds every secret its generator makes on each tick (a rotated key or a minted token per poll) to a `Set` that is never cleared or capped. An hours-long stream holds them all, and its one throw scrubs against every value. RFC 0105 Ordering's amendment names the reach, not the growth.
Fix: the same cap as finding 5.

## What held
- Marking after awaits, in `Promise.all`, a `setTimeout`, `queueMicrotask`, an `AsyncGenerator`, a module-level `EventEmitter` emitted inside the request, a number secret (4242), a one-character secret as a whole token: all `[secret]`.
- A page route's guard parsing a secret after an await and throwing: one `[secret]` diag, 500, dev body without the value.
- A detached timer from request A making a secret that request B later throws: unmarked in B, as RFC 0105 Risks and Known limits state (not reported).
- Live loader throwing a non-Error string holding a secret: one scrubbed diag, an `err` line `str [secret]` in dev, no console output.
- `bearerOf`: tabs only, `Bearer\tabc`, `Bearer \t abc` → `undefined`; ` \t Bearer abc \t ` → `abc`; 1 MB headers (long token, `=` run, space run, tab/space run) in 2 to 7 ms, all `undefined`.
- `shownPath`: union of object and record → `*` for a field name and a key (hides more than it needs to, never data); `array(record(object))` → `0.*.n`; nested records → `*.*`; a `json` field → `meta.*.*`.
- Built server: `environments.ssr.resolve.noExternal: true` with `codeSplitting: false` bundles one copy of `@keel/schema` (read from `packages/compiler/src/vite.ts`; no build was run).
- Runners start under `requestSecrets.exit`; the std-jobs wake (`idle`/`wake`) resumes a runner's await in the runner's own context, so an `enqueue` inside a request does not pull the runner into the request's set.
- Regex metacharacters in a secret are escaped (`literal` covers every syntax character the `u` flag requires).
