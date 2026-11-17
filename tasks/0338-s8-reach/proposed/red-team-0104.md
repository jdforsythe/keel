# Red team: RFC 0104 (action output and bearer)

Range `bd53d830..de6be29f`. Probes ran as `packages/server/test/zz-probe.test.ts` (deleted); a copy of each is in the session scratchpad (`redteam0104/server-probe1.ts`, `probe2.ts`). Each probe builds an app with `createApp` (sim ctx, seed 1337, json log sink) and sends a `Request`.

## Findings

### 1. medium: a live loader that throws prints the revealed bearer to `console.error`, unscrubbed
- Probe: an API route whose loader is an async generator: `yield ok({}); throw new Error(\`live boom ${reveal(bearer)}\`)`. Send `GET /api/live`, `accept: text/event-stream`, `authorization: Bearer zzTOKENzz1234567890`, mode `production`. Spy on `console.error`.
- Expected: docs/THREAT-MODEL.md **Bearer** says "It is scrubbed from the log". packages/server/README.md says the bearer is "a `Secret` whose revealed text no `diag` holds". k.privacy says `bearer` counts as a `Secret` input for the server log.
- Actual: `console.error` gets `live boom zzTOKENzz1234567890`. The configured `log` sink gets only the `req` line and no diag. `liveStream.ts` calls Hono's `streamSSE(c, cb)` without `onError`, and Hono then runs `console.error(e)` (hono/dist/helper/streaming/sse.js:36). RFC D5 sends `bearer` to live loaders, so stderr now receives a credential. Before, only `.pii()` values reached it.
- Fix: pass `streamSSE` an `onError` that turns the throw into a `keel.unexpected` diag through `scrubbedCause(..., rq)` and writes it to the log sink, never to the console. Then add a k.privacy conformance case: "a live loader throwing the revealed `bearer` logs `[secret]`".

### 2. low: the E1554 diag of an action `output` names a record key, which is a value
- Probe: `action({ input: s.object({}), output: s.record(s.int({ max: 1 })) }, async () => ok({ "alice@example.com": 5 }))`, then POST.
- Expected: k.api Output and the server README say the E1554 diag names "the first refused path, never the value". RFC D2 says the same.
- Actual: `{"kind":"diag","code":"E1554","message":"action api.rec data fails its output schema at alice@example.com"}`. A record keyed by an email, a minted token or any other `.pii()` or secret text puts that text in the log. `notePii` runs only after a parse succeeds, so the `[pii]` scrub does not cover it. Loaders have had the same path since before this RFC. Actions now share it through `outputRefused.ts`.
- Fix: in `outputRefused`, write a record-value segment as `*` (as `piiPaths` does). This needs the walk from the node to know which segments are record keys. Alternatively, scrub the message with `piiValues` of the raw value before writing it.

### 3. low: a guard's throw is not scrubbed of the bearer; in dev the response body echoes it
- Probe: `guard({}, async ({ bearer }) => { if (bearer) throw new Error(\`guard boom ${reveal(bearer)}\`); return ok(null) })` on an API route with a loader. Send `GET` with `Bearer zzTOKENzz1234567890`, mode `dev`.
- Expected: the README says "`keel.unexpected` messages never hold" the request's revealed secrets (RequestScope `secrets`). Loader and action throws go through `scrubbedCause`.
- Actual: dev answers 500 `{"code":"keel.unexpected","message":"Error: guard boom zzTOKENzz1234567890","data":{"cause":"Error: guard boom zzTOKENzz1234567890"}}`. `runGuards` passes `runGuard`'s raw `attempt` error to `bareError` without `scrubbedCause`, and the throw has no diag at all. Production masks it as `unexpected`.
- Fix: apply `scrubbedCause(error, rq)` to a guard's `keel.unexpected` before `bareError`, as `runLoaders` and `runAction` do. Optionally write the throw as a `keel.unexpected` diag, as for loaders.

### 4. low: any unchecked bearer joins the scrub set and blanks unrelated text in diags and dev error bodies
- Probe: an API action that throws `new Error("database connection lost while updating action row")`. POST with `authorization: Bearer ion`, then with `Bearer row`, mode `dev`.
- Expected: RFC D6 adds the bearer to the scrub set so the token never reaches the log. Nothing says a client may rewrite the server's diagnostics.
- Actual: with `Bearer ion` the diag reads `act[secret] api.boom threw: Error: database connect[secret] lost while updating act[secret] row`. The dev error body is changed the same way. Any client, with no valid credential, can blank any substring of 3 or more characters (case-insensitive, including inside words) in every diag and frame of its own request. Examples: `Bearer api.boom`, `Bearer server.ts`, a file name. This makes incident evidence harder to read. It leaks nothing, because the token is the sender's own. Before this RFC the same was possible only through an action's `s.secret` input field. Now it works on every API route, GETs included.
- Fix: for `bearer`, match only whole tokens (the `SHORT` rule) for any length, or require a minimum length such as 16 before a value joins `secrets`. A guessable short bearer is no credential worth scrubbing inside words.

### 5. low: a request carrying `authorization` to an unmatched path gets no `no-store`
- Probe: `GET /api/nope` with `authorization: Bearer x`. No route matches.
- Expected: docs/THREAT-MODEL.md **Bearer**: "a response to a request that carries one is `no-store`". The sentence is unqualified. k.api limits it to an API route's answer.
- Actual: 404 with no `cache-control`. `createApp` sets `no-store` only when `matched?.def.api === true`. The same holds for a response a peer forwards, unless the peer sets it.
- Fix: either set `no-store` whenever `authorization` is present (cheap, and closer to RFC D7's "valid or not"), or reword the threat model to "an API route's response".

### 6. low: the parse trims JS whitespace, not HTTP whitespace
- Probe: `authorization` values `" Bearer abc"`, `"Bearer abc "`, `"Bearer abc\u000b"` and `"\u000cBearer abc"`.
- Expected: RFC D6 rules 2 and 3 say the value as `Headers.get` gives it, trimmed. The grammar is RFC 7235 `credentials`. A no-break space or a vertical tab is not OWS.
- Actual: every one reveals `abc`, because `bearerOf` applies `String.prototype.trim()`, which also strips U+00A0, U+FEFF, VT, FF and U+2028. A byte 0xA0 on the wire is read as latin1 U+00A0. This is harmless today. It is a second, looser grammar than the one the services client enforces (`/^[\w.~+/-]{1,4096}=*$/`), and the spec's "less leading and trailing whitespace" does not say which whitespace.
- Fix: drop the `.trim()`, since `Headers.get` already trims HTTP whitespace, or trim `[ \t]` only. Say "spaces and tabs" in k.api Bearer.

## What held
- Parse table: casing, several spaces, tab between scheme and token, tab, comma or space inside the token, `=` in the middle, an empty token or `=` alone, 4,096 and 4,097 characters, a 4,096-character token followed by 5,000 `=` (accepted, as the grammar says), `Basic`, `Token`, `Bearerabc`, two headers, non-ASCII `é`, U+0085: all as RFC D6 says. None threw and none answered an error.
- Who gets it: page guards and loaders get `undefined`. A page action's `at` carries no `bearer`. A redirect hop's guards run without it. The client router drops API actions (`actionAt`) and gives `undefined`. A page layout over an API id is not in the API route's chain, so no page guard or loader runs or sees the token. Live loaders get it. Peer forwarding sends the header to the peer deployable, which parses it itself (that is k.topology forwarding as written).
- CORS and same-site: a cross-site POST from an unlisted origin with a bearer and no `x-keel` is 403. A bearer skips and reorders no check. `caller` is unchanged.
- `no-store` with `authorization` on API routes: a 308 for a trailing slash (GET and POST), a 404 for bad params, 403 for a guard denial, a cross-site 403, 405 for HEAD and OPTIONS. A write without `authorization` that a guard denies or the same-site check refuses also answered `no-store`.
- `output`: extra fields are stripped from the answer (`{id, hidden, nested}` → `{id}`). A refused value saves nothing. A conflict sends no value. `.pii()` in `output` joins the scrub set.
- E1113 walk: covers secret, optional, nullable, format, array, record, object, union and anyOf, which is every node kind (`schema/src/internal/Node.ts`). `s.json()` refuses a `Secret` (non-plain prototype). No lazy or reference node exists.
- E1512: `routes.actions` checks own `output` on every entry at run time, so a spread, a widened table or `channelRoute` cannot get past it. `keel check` maps the type text.
- Services: client and server token grammars match (`\w` is ASCII without `u`). A non-`Secret` string `bearer` is `api.input`. `JSON.stringify` of the input gives `[secret]`. `events` never reconnects. `fail.input` holds only paths. Module calls use `redirect: "manual"`. std-offline refuses a `Secret` in an entry at run time (the entry schema is JSON).
- Session capture and ctx events carry no request header. `#k-state` and inspect hold no bearer unless app code puts one in a store (RFC Questions 4).
