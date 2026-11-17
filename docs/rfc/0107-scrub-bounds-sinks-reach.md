# RFC 0107: scrub: bounds, sinks and reach

Status: accepted (user for the decisions, orchestrator for the choices, 2026-11-17). For backlog 0717, 0716, 0668, 0654 and 0682. ADR-0130 records it. The user chose each of the five answers; this RFC gives their exact shape, the spec diff and the conformance diff. Where the choice left a detail open, the detail is decided under the default it applies (`docs/WORKFLOW.md` RFC defaults) and listed under Choices; the two security calls the defaults did not settle are under Stated limits.

## Decisions
- D1 (0717): a request's secret set holds at most 100,000 distinct values. The 100,001st puts the set past the cap, exactly as 2,000,000 characters of written forms do, and every scrubbed text of that scope is then written as it is past the character cap (D2).
- D2 (0716): past either cap the server keeps its own prefix and marks the rest: a throw's record reads `loader <id> threw: [secret]`, not `[secret]`. Each frame and the `req` path are one mark. Below the caps nothing changes: the whole message, prefix included, is scrubbed.
- D3 (0668): both halves. (a) E1111 covers an `s.secret` node in a route's `params` or `search` as it covers `.pii()`; it stays an error with no fix diff. (b) The `req` record's path goes through the same scrub as a `diag` message (`redacted`: the request's secrets, then its personal data), after the handler settles.
- D4 (0654): `keepRunning` enters a fresh scrub scope around each call of a runner's `run`, and the runner's `failed` record is scrubbed with that scope's set. A secret made at process startup stays in no scope: a stated limit.
- D5 (0682): `Secret` keeps the schema node it was sealed under, and `secretValues` walks that node beside the value: a record's keys, a `json` value's keys and an object's undeclared keys are data and are marked; a declared field name is not. The server's listener is unchanged.
- D6: spec placement. Every sentence lands in k.privacy (it owns the scrub, RFC 0105 D7). k.server, k.schema and k.topology are unchanged. k.privacy goes from 5,992 to 5,996 characters (1,498 to 1,499 tokens) by trimming its own prose and merging two personal-data conformance bullets.

No public API changes. One error code's reach grows (E1111). `@keel/schema` gains no export; its internal `secretValues` keeps its signature.

## Problem
Read on `jdforsythe/test-impl` at `4e5c2abd`.

**0717, the count.** `holdSecrets` (`packages/server/src/internal/holdSecrets.ts`) stops adding to a request's set only once `automatonOf` says its distinct folded forms pass `SCRUB_CAP` (2,000,000). Its own bound counts unfolded forms, so values whose folded forms repeat (case variants of one string) keep the set growing, each pass of the bound doubles it and rebuilds the automaton, and nothing caps the set's size. A live loader that makes a secret per yield for a day holds every one of them.

**0716, the prefix.** `runLoaders.ts:29`, `runAction.ts:109`, `runGuards.ts:48` and `liveStream.ts:82` each build a throw's message as `<kind> <id> threw: ${scrubbedCause(...).data.cause}`. Past the cap `scrubbedCause` gives `[secret]` for the cause, so the record would read `loader app.a threw: [secret]`. For a document GET or an action, `createApp`'s settle pass then runs `redacted` over the whole message, which past the cap is one mark: the line reads `[secret]`. A live loader's record is written by `liveStream` itself and keeps the prefix. One request kind names the loader, the other names nothing, and k.privacy says "the message and each frame are one mark".

**0668, the URL.** `createApp` writes the `req` line with `path = new URL(raw.url).pathname`, unscrubbed, after `routed()` settles; the set lives inside `routed`. A route `/reset/:token` with `params: s.object({ token: s.secret(s.string()) })` writes `GET /reset/tok-9a8b7c6d5e4f app.reset 200 4ms`. The query is never written (`path` is the pathname). E1111 reads only `.pii(`: `schemaMarks` (`packages/check/src/internal/schemaMarks.ts`) returns `marked` for a member call named `pii` and walks `s.secret(...)` as a plain call.

**0654, outside a request.** `createApp` starts runners under `requestSecrets.exit`, so a `Secret` a runner makes joins no set, and its `failed` callback writes `runner rejected, rerun in 1000 ms: <message>` with no scrub at all. `privacy-secret-reach.test.ts` pins both: "One made in a runner is not marked". A `Secret` parsed at module scope or in `createApp`'s config is made before any scope exists.

**0682, keys.** `secretValues` (`packages/schema/src/internal/secretValues.ts`) gives each string and number inside a secret and no key. `s.secret(s.record(s.string()))` holding `{ "acct-7f3a9c": "x" }` and `s.secret(s.json())` holding `{ "jk-41b2c3": 1 }` leave their keys in clear. Marking every key was tried and reverted: a declared field name (`flag` in `s.secret(s.object({ key, n, flag }))`) is schema text, and a conformance case expects `obj flag true end` to stay. The value alone cannot tell the two apart; the schema can, and `piiValues` already walks a schema beside a value for record keys under `.pii`.

## Proposal

### 1. The count cap (0717)
`packages/server/src/internal/SECRETS_CAP.ts` exports `SECRETS_CAP = 100_000`. `packages/server/src/internal/pastCap.ts` exports `pastCap: WeakSet<ReadonlySet<string>>`, the sets known to be past a cap.

`holdSecrets(into, values, count?, cap?, most = SECRETS_CAP)`: after adding a value, when the set holds more than `most` distinct non-empty values (`into.size - 1`, the empty string being the sentinel it already adds), it adds `into` to `pastCap`, sets its bound to -1 and returns. When `automatonOf([into])` is `"over"` it adds `into` to `pastCap` too. A set in `pastCap` takes no more values. `automatonOf(sets, ...)` returns `"over"` when any of `sets` is in `pastCap`, before its cache and before building, so `scrubbed` writes its mark for every text of that scope from then on.

The value counted is a distinct string in the set: a number counts as its `String()`, a value made twice counts once, and a case variant counts as a value. The personal-data set has no count cap: it is filled from a request's own input, outputs and store states, which `maxBodyBytes` and the app's schemas bound.

What "fails closed" covers, for both caps alike:
- A `diag` record: its message after the server's prefix is one mark (`[secret]` if the scope's secret set holds a value, else `[pii]`); a record with no prefix (E1554, E1508) is one mark whole; each frame is one mark.
- The `req` record's path is one mark: `GET [secret] app.reset 200 4ms`. The method, route id, status and time are the server's.
- The dev response body of a `keel.unexpected`: `scrubbedCause` scrubs the cause, which past a cap is the mark, and clips the message from it, so the body's message and `data.cause` are both `[secret]`. A live loader's last `data:` line carries the same error. Production bodies already say `unexpected`.
- A runner's `failed` record (D4): `runner rejected, rerun in 1000 ms: [secret]`, each frame `[secret]`.
- A scope that is past a cap stays past it: a later value cannot bring a text back.

### 2. The prefix (0716)
`Diag` (`packages/server/src/internal/Diag.ts`) gains `lead?: string`: the server's own text at the start of `message`, which holds no request data. The four throw sites set it: `loader ${id} threw: `, `action ${id} threw: `, `guard ${lvl.id} threw: `, and in `liveStream` `loader ${m.route.id} threw: `; `createApp`'s runner record sets `runner rejected, rerun in 1000 ms: `. `message` keeps its full text (`lead` + cause), so `diagLine` and every reader of `message` are unchanged; `diagLine` never writes `lead`.

New `packages/server/src/internal/scrubbedDiag.ts`:

```ts
/**
 * `d` as the log may hold it (k.privacy Server log): below the scrub's caps its message and each frame `redacted`
 * whole; past a cap its `lead` kept and the rest of its message one mark, and each frame one mark.
 */
export function scrubbedDiag(d: Diag, rq: Pick<RequestScope, "pii" | "secrets">): Diag;
```

Past a cap is `automatonOf([rq.secrets, rq.pii]) === "over"` (cached, so the check costs a map read); the rest of the message becomes `redacted(rest, rq)`, which past the cap is the mark. `createApp`'s settle pass maps `r.value.diags` through `scrubbedDiag`, `liveStream` writes `scrubbedDiag({ code, lead, message, frames }, rq)` in place of its own `redacted` frame map, and the runner record goes through it with the runner's set (D4). One function scrubs every `diag` record.

What stays past a cap: the record's `kind` and `code`; the kind word (`loader`, `action`, `guard`); the route, loader or guard id; `threw: `; the runner sentence. A route id is declared in code, not sent by a client. What is marked: everything a throw or a client supplied (the cause, the frames, the path).

### 3. Secrets in the URL (0668)
**(a) E1111.** `schemaMarks` returns `marked` for a member call named `secret` as for `pii` (`s.secret(...)`, `ns.s.secret(...)`, through consts, imports and spreads as today). `piiInRouteUrl` keeps code E1111 and its `unread` message; its `marked` message becomes `personal data or a secret in route ${part}; a URL reaches history and logs` (73 characters with `params`). It stays an error: a token in a path or query reaches browser history, `Referer`, proxy and CDN logs, which no server scrub reaches. No fix diff (the fix is a different flow). The audited `tableSearch` stays exempt: its `search` schema is built by `@keel/std-tables` from `s.enum`, `s.int`, `s.string` and `s.boolean` and never holds a column's schema, so it never holds `s.secret`.

Catalog row (`packages/check/src/internal/EXPLANATIONS.ts`):
```
"E1111",
"a .pii() or s.secret node, or a schema it cannot read, in a route params or search",
"A path or query reaches browser history and proxy logs, which no redaction reaches.",
"params: s.object({ token: s.secret(...) }) -> carry it after # in the link; the page posts it as an action input",
"k.privacy",
```

The recommended reset or invite link is `https://app.example/reset#t=<token>`: the fragment never leaves the browser, the page's island reads `location.hash`, clears it with `history.replaceState`, and posts the token in an action `input` field `s.secret(s.string())`. A form the person pastes a code into is the other form; both put the token in a POST body, which `maxBodyBytes`, the same-site check and the scrub cover.

**(b) The `req` path.** In `createApp`'s handler the request's `secrets` and `pii` sets are made before `routed` (they are today made inside it) and passed into `rq`. After the response, the `req` line is written with `path: redacted(path, { secrets, pii })`: the same automaton and passes as a `diag` message, so a secret becomes `[secret]` and a personal-data value `[pii]`, in each form `scrubbed` matches (as written, `encodeURIComponent`, base64 and base64url, case-folded; under 3 characters only as a whole token). The set is the request's own and is complete for the path: `params` and `search` are parsed inside `requestSecrets.run`, so a secret param joined the set before the handler ran. A route `/reset/:token` with a secret param logs:

```
GET /reset/[secret] app.reset 200 4ms
{"kind":"req","method":"GET","path":"/reset/[secret]","route":"app.reset","status":200,"ms":4}
```

A request that never enters `routed` (a preflight, `/__keel/csp`, a path forwarded to a peer, inspect) has empty sets and its path is written as it came. A path whose params fail their schema (404) made no secret and is written as it came. The query is not written, as today.

### 4. Runners (0654)
`keepRunning` runs each attempt as `requestSecrets.run(secrets, () => runner.run(ctx, signal))` with `secrets = new Set<string>()` made for that attempt, and passes the set to `failed(message, frames, secrets)`. `createApp`'s `failed` builds `{ code: "keel.unexpected", lead: "runner rejected, rerun in 1000 ms: ", message: lead + message, frames }` and writes `scrubbedDiag(d, { secrets, pii: new Set() })`. Every job, schedule fire and workflow step a runner starts runs inside its `run` and joins its set; a request the runner makes in process (`service({ module })`) runs in that request's own scope. `createApp`'s `requestSecrets.exit` around the runners goes: each `run` now enters its own scope, so no runner can inherit a request's (default 2). A restart after a rejection gets a fresh set. A `run` that lives for the life of the process keeps one set; the count cap bounds it, and past it that runner's `failed` record is its prefix and one mark.

A secret made at startup (module scope, `createApp`'s config, a `Secret` parsed before the first request) is in no scope. THREAT-MODEL, Secrets commitment, carries it; the sentence it gains is under Docs.

### 5. Keys inside a secret (0682)
`packages/schema/src/Secret.ts`:

```ts
private constructor(value: T, inner: Node) { ... }
/** A new secret of `value`, sealed under `inner` (the `secret` node's inner node); the listener hears of it. */
static of<T>(value: T, inner: Node): Secret<T>;
/** The node `secret` was sealed under. For `secretValues` only. */
static innerOf(secret: Secret<unknown>): Node;
```

A private `#inner: Node` field, set once and frozen with the instance. `seal` calls `Secret.of(seal(node.inner, x), node.inner)`; `gen` calls `Secret.of(v, node.inner)`. Those are the only two callers. `Node` is imported as a type, so the import graph does not change.

`secretValues(value: unknown): string[]` keeps its signature, its visit cap (1,000,000) and its iterative walk. A work item becomes `{ x, node: Node | undefined, inside: boolean }`. Outside a secret it walks the value as now, looking for secrets. At a `Secret` it continues with `Secret.open(v)` under `Secret.innerOf(v)`, inside. Inside, by the node's kind:
- `optional`, `nullable`: the inner node; `format`: the base node.
- `array`: each item under `item`.
- `record`: each key is a value; each entry's value under `value`.
- `object`: each declared field's value under its node, the field name not given; each undeclared own key and its value are given whole (an open object keeps them; a closed one fails `parse` after `seal`, and its values are given anyway).
- `union`: the variant `variantOf` picks; `anyOf`: the first member `fits`; neither: the value whole.
- `json`, and a node of `undefined`: the value whole.
- `secret`: the value is a nested `Secret` and is opened under its own node.
- a leaf: a non-empty string or a number as `String()`; a boolean is not a value.

"Whole" is today's rule plus keys: every non-empty string, every number and every own key at any depth. The order is the order met, as today.

The server calls nothing new: `noteRequestSecrets` still runs `holdSecrets(into, secretValues(made))` for each `Secret` the listener hears of. The listener's signature does not change, and no raw value leaves `Secret.ts` through it.

**Budget.** `@keel/schema` is measured from `src/index.ts`, which bundles `Secret.ts` and not `secretValues` (an `./internal` file, external to every other package's bundle). `Secret` grows by one field, a constructor argument and one static: an estimated 25 to 40 B gzip against `5.5kb` (5,632 B). The lane measures it; if it passes, the budget is re-based one step with the reason in the commit (default 7). `@keel/server` and `@keel/check` budgets are touched by sections 1 to 4 only: the server lane adds about 300 B against `22.75kb`, the check lane about 120 B.

**Property tests** (`packages/schema/test/secretValues.property.test.ts`, seed 1337):
- Equivalence with `piiValues`: for every generated schema `S` without a `secret` node and every `x` from `gen(S)`, the set of `secretValues(s.secret(S).parse(x))` equals the set of `piiValues(S.pii("content"), S.encode(x))`, plus the undeclared keys and values of any object `x` holds. Formats keep their base value, so the parsed and encoded values agree.
- Declared names: for every generated object schema whose field names occur in no value, no field name is given.
- Data keys: every key of a generated `s.record` value and of a generated `s.json` object value at any depth is given.
- Whole where nothing matches: a `union` value with an unknown discriminant and an `anyOf` value no member fits give every string, number and key under them.
- Nesting: a secret inside a secret gives the inner one's values once, by its own node.
- Bounds: a 1,000,000-deep array under `s.secret(s.json())` returns without overflowing the stack; past 1,000,000 visits nothing more is given (as today).
- `Secret.innerOf(Secret.of(v, n)) === n`, and the instance stays frozen.

## Alternatives
- 0717: a window of the most recent values (a secret made early and thrown late is written in clear), or marking per event (a stream writes one record, at its end). Rejected in `tasks/0338-s8-reach/proposed/stream-secrets-0672.md`. Counting folded forms in `holdSecrets` closes the case-variant growth but leaves the set's size unbounded for short values.
- 0716: scrub the whole message past the cap. Rejected by the user: the record then names nothing, and the prefix holds no request data.
- 0668: only the check, or only the run-time scrub. The check alone leaves a package's route table and an unchecked build writing the token; the scrub alone leaves browser history and every proxy in front of the server.
- 0654: a scope per job, per fire, per workflow step. Better resolution, and each is in a stdlib package the kernel does not import; one scope per `run` covers all of them from `keepRunning`. A process-wide set for startup secrets that every scope reads: left for a later RFC (`tasks/FUTURE.md` candidate), since every scope would then pay for every startup value.
- 0682: mark every key (rejected: declared names are not data and a conformance case pins `flag`); pass the node to the listener (`(made, inner)`), which moves the walk's input out of `Secret.ts` and changes the listener for no gain.

## Spec diff
k.privacy only. The whole new text of each changed paragraph or bullet follows; counts are UTF-16 code units of the section file (`Math.ceil(length / 4)`, as `pnpm spec` measures). Before: 5,992 characters, 1,498 tokens. After: 5,996 characters, 1,499 tokens of 1,500.

**Secrets** (last two sentences; the sentence before them is unchanged):
```
**Secrets.** `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. `decodeStrings` reads the inner type. `gen` wraps a generated inner value; `doc()` is `secret<T>`. What `reveal` returns is plain data: a store, driver or log keeps it as written. A secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field (E1113, k.api).
```

**Personal data** (the `piiValues` sentence; two sentences become one with the same content):
```
**Personal data.** `schema.pii(class)` marks any schema node as personal data, in a `*.schema.ts` file. `PiiClass` is closed: `name` · `contact` (email, phone, handle) · `location` (address, coordinates) · `identifier` (government, account and customer numbers, birth dates) · `financial` · `special` (health, biometric, belief, ethnicity, orientation) · `network` (IP address, device id) · `content` (text a person wrote). The mark keeps the type and every derivation (`parse`, `encode`, `decodeStrings`, `gen`); the node gains `pii: class`, which covers every value under it; `doc()` appends ` pii(<class>)` and JSON Schema adds `x-keel-pii`. From `@keel/schema`, both pure: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, `path` dotted with `*` for an array item or record value, the class its nearest mark's; `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and number (as `String()`) under a marked path, a marked record's keys and a marked open object's undeclared keys and values.
```

**Sinks**, Inputs bullet (drops a comparison the k.ctx reference carries):
```
- Inputs: a control bound (k.forms `field`) to a marked path carries `data-k-pii="<class>"`, and the ctx observer reports its `input` values and one-character `keydown` keys as `x` repeated (k.ctx).
```

**Sinks**, Server log bullet:
```
- Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` of the request's decoded action input, its loaders' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made while the request runs (`bearer` too) becomes `[secret]`. A runner's `run` is scoped alike; startup is not. An action's `output` is a loader's. Past 2,000,000 characters of these values' written forms or 100,000 secret values, a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if the scope made a secret.
```

**Sinks**, URLs bullet:
```
- URLs: a marked or `s.secret` node in a route's `params` or `search` schema is E1111, since a path or query reaches history and proxy logs Keel cannot redact.
```

**Sinks**, closing line:
```
In dev, `/__keel/inspect` serves store values unredacted; it is not a sink.
```

**Rules** (E1111's entry; E1105, E1112 and E1113 unchanged):
```
**Rules.** E1105 `reveal` imported in an app file other than `*.server.ts`, test files included · E1111 a `.pii()` or `s.secret` node in a route `params` or `search` schema (fix: none), or a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key); a package's exported route table or schema is the package's, as is the schema returned by an export on the checker's closed audited list, which refuses a marked column (`tableSearch`, `@keel/std-tables`). · E1112 a revealed value reaching a log, storage, a file, store state or a throw (k.reveal) · E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none).
```

**Conformance.** Removed: "An action throwing an `Error` whose message holds a marked input value logs a `diag` record holding `[pii]` and not the value, in dev and production." Changed and added, each whole:
```
- A marked or `s.secret` field in a route's `params` or `search` schema is E1111; in an action `input` it is not.
- An action throwing an `Error` whose message or a stack frame's file path holds a marked input value logs a `diag` record with `[pii]` in its place, in dev and production.
- An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await`, a record or `json` key in one, and a runner's; a boolean or declared field name logs as is; of two overlapping requests each marks only its own.
- A secret route param is `[secret]` in the `req` path. Past 100,000 secret values a loader's throw logs `loader <id> threw: [secret]`.
```
The other seven bullets are unchanged and keep their order. Clause numbers after the first changed bullet move; the ledger is rewritten on a quiet tree after the conformance commit.

## Conformance diff
Written by the `conformance-writer` from the spec text above, in one `rfc:0107` commit before any implementation lane starts.

**`packages/server/conformance/privacy-secret-reach.test.ts`** (changed):
- Headers: line 4 quotes the Server log sentence "Each string, number and key but a declared field name (not a boolean) in a `Secret` made while the request runs (`bearer` too) becomes `[secret]`."; line 6 quotes "A runner's `run` is scoped alike; startup is not."; line 7 quotes the changed `[secret]` Conformance bullet; line 8 quotes "Past 2,000,000 characters of these values' written forms or 100,000 secret values, a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if the scope made a secret."
- The runner case (line 305) flips: a runner that parses `"runner-5d3c1f"` as a `Secret` and rejects with its revealed value logs the `runner rejected, rerun in 1000 ms: ` line holding `runner [secret]`, and no line holds `runner-5d3c1f`. The startup case (line 295) stays.
- The three cap cases (lines 352, 402, 414) keep their inputs and frames (`["[secret]", "[secret]"]`, `["[pii]", "[pii]"]`); the expected message becomes `action app.a threw: [secret]` (twice) and `action app.a threw: [pii]`.
- New, in dev and production: a secret `s.record(s.string())` input with key `acct-7f3a9c` thrown as `Error("got " + key)` logs `got [secret]`; the same for `s.secret(s.json())` with key `jk-41b2c3`. The `flag` case stays as is.
- New, in dev and production, for a loader on a document GET and for a live loader on an event-stream GET: a loader that parses `s.secret(s.array(s.int())).parse([0, ..., 100000])` (100,001 distinct values, under 1,500,000 characters of forms, so only the count passes) and throws `Error("refused 7")` logs one `diag` whose message is `loader app.a threw: [secret]` with each frame `[secret]`; in dev the response body (document) or the last `data:` line (stream) holds `[secret]` and not `refused 7`. With `[0, ..., 99999]` the message starts `loader app.a threw: ` and holds `refused [secret]`.
- New: a runner whose `run` makes 100,001 distinct secret values and rejects logs `runner rejected, rerun in 1000 ms: [secret]`.

**New `packages/server/conformance/privacy-req-path.test.ts`** (in dev and production, compact and json): a route `/reset/:token` with `params: s.object({ token: s.secret(s.string()) })` (a server test file, outside `keel check`) gets `GET /reset/tok-9a8b7c6d5e4f`, and the `req` record's path is `/reset/[secret]` and no line holds `tok-9a8b7c6d5e4f`; a params value that fails its schema is written as it came; a request with no secret writes its path unchanged; a loader whose output marks `"ada-lovelace"` `.pii("name")` served at `/people/ada-lovelace` writes `/people/[pii]`.

**`packages/server/conformance/privacy-diag-scrub.test.ts`**: header lines 2 and 3 quote the merged personal-data bullet and the new Server log sentence. No assertion changes.

**`packages/server/conformance/privacy-diag-frames-0095.test.ts`**: header line 1 quotes the merged personal-data bullet. No assertion changes.

**`packages/server/conformance/bearer-0104.test.ts`**: header line 14 quotes the new Server log sentence. No assertion changes.

**`packages/check/conformance/privacy-e1111.test.ts`**: header line 1 quotes the new Rules entry and Conformance bullet. New properties: `s.secret(s.string())` as a `params` field and as a `search` field (also `.optional()`, through a const, an import from a `*.schema.ts` file and a namespace import of `@keel/schema`) is one E1111 with `part` `params` or `search`; the same field in an action `input` is none; the message is `personal data or a secret in route params; a URL reaches history and logs`.

No other conformance file changes. `runner-rejection-diag-0092.test.ts` throws no secret and keeps its text.

## Build order
1. Orchestrator: `spec/kernel/k.privacy.md` (the text above). Then the `conformance-writer` writes the conformance diff (one `rfc:0107` commit). Red until the lanes land.
2. Three lanes in parallel, disjoint packages, each verifying with its package's `check`, `build` and one test file at a time:
   - **schema** owns `packages/schema/src/Secret.ts`, `src/internal/seal.ts`, `src/gen.ts`, `src/internal/secretValues.ts`, `packages/schema/test/secretValues.property.test.ts` (new) and the schema README line for `secretValues`; changeset `@keel/schema` patch. Done when the property tests above pass and `pnpm budgets` holds `@keel/schema`.
   - **server** owns `packages/server/src/internal/SECRETS_CAP.ts` (new), `pastCap.ts` (new), `holdSecrets.ts`, `automatonOf.ts`, `Diag.ts`, `scrubbedDiag.ts` (new), `runLoaders.ts`, `runAction.ts`, `runGuards.ts`, `liveStream.ts`, `keepRunning.ts`, `createApp.ts`, the doc comments of `noteRequestSecrets.ts`, `requestSecrets.ts` and `redacted.ts`, unit tests under `packages/server/test/`; changeset `@keel/server` patch. The record-key and `json`-key conformance cases go green only once the schema lane lands; every other case is the server's alone.
   - **check** owns `packages/check/src/internal/schemaMarks.ts`, `src/rules/piiInRouteUrl.ts` (message, `explain`, doc comment), `src/internal/EXPLANATIONS.ts` (the E1111 row), unit tests under `packages/check/test/`; changeset `@keel/check` patch.
3. Orchestrator: docs (below), `tooling/budgets.json` if a lane reports a re-base, the ledger on a quiet tree, `tasks/BACKLOG.md` (0717, 0716, 0668, 0654, 0682 closed), `docs/HANDOFF.md`.

## Docs
- `docs/THREAT-MODEL.md`, Secrets commitment: the sentence "and the server writes `[secret]` in its `diag` records in place of each secret a request makes: its input, `bearer`, a later parse, a minted token (past the scrub's size cap, each `diag` is written as one mark). The `req` line's path is written as it came, so a secret in a route's `params` or `search` is logged." becomes "and the server writes `[secret]` in its `diag` records and its `req` path in place of each string, number and data key of each secret a request or a runner's `run` makes: its input, `bearer`, a later parse, a minted token, a record's keys (past 2,000,000 characters of their forms or 100,000 values, everything after the server's own prefix is one mark). A secret in a route's `params` or `search` is E1111, and the query is never logged. A secret made at process startup, at module scope or in `createApp`'s config, is in no scope: a log line that holds its revealed value writes it."
- `docs/COMPLIANCE.md` (where marked values are redacted), the `keel-compliance` skill (E1111 now names `s.secret`; the reset-link form), `packages/server/README.md` and `packages/check/README.md` where they describe the scrub and E1111.

## Migration
An app with `s.secret` in a route's `params` or `search` now fails `keel check` with E1111. Move the value out of the URL: a link carries it after `#` and the page posts it in an action `input`. No golden app has one (`grep s.secret apps` finds only `golden-2`'s `Credentials.schema.ts`, an action input). Log readers see `[secret]` and `[pii]` in `req` paths, `loader <id> threw: [secret]` in place of `[secret]` past a cap, and a runner's `failed` record scrubbed.

## Token impact
k.privacy 1,498 to 1,499 tokens of 1,500. No other section changes; the map is unchanged.

## Choices
Each detail the user's answers left open, and the default applied.
- C1: "100,000 values" counts distinct non-empty strings in the set, numbers as `String()`; the cap is reached at the 100,001st. The empty-string sentinel is not counted. (Least surprise; matches `holdSecrets`' set.)
- C2: below either cap the prefix is scrubbed with the rest, as today; it is kept only past a cap. A record with no prefix (E1554, E1508, whose text can carry a redirect href) is one mark past a cap. (Default 4: fail closed.)
- C3: the `req` path uses both passes, `[secret]` and `[pii]`, as a `diag` message does. The user's answer named secrets; a path is a log sink and default 4 redacts what lands in a log. To scrub secrets only, `createApp` passes `{ secrets, pii: new Set() }`.
- C4: E1111 for a secret is an error with no fix diff, and reuses `marked`; the message names both. (Same code, same severity: one way.)
- C5: `requestSecrets.exit` around runners is removed, since each `run` enters its own scope (default 2).
- C6: inside a secret, an object's undeclared keys are given whether the object is open or closed, and a value no union variant or member matches is given whole. (Default 4; a closed object's extra keys only reach `secretValues` on a value `parse` then refuses.)
- C7: `Secret` holds its node rather than the listener taking it, so the walk has one input and the server is unchanged.

## Stated limits
Both are accepted as limits. E1111 is an error, so a secret reaches a URL, and from there a log, only in an app that skipped `keel check` or through a package's own route table.
- O1: a path the server forwards to a peer (`createApp({ peers })`, split topologies) is logged by the forwarding server as it came: that server parses no params and makes no secret, so its set is empty. E1111 keeps app routes clean; a package route table with a secret param served by a peer would log its token at the front. A stated limit, for THREAT-MODEL: the front cannot parse a peer's schemas without loading its routes.
- O2: a secret made inside an in-process request that a runner calls through `service({ module })` joins that request's set, not the runner's; if the runner later throws the revealed value, its `failed` record holds it. Loader and action outputs cannot hold `s.secret` (E1113), so the value can only come back through app code. A stated limit.
