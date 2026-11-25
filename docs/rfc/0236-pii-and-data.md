# RFC 0236: personal data and plain data: undeclared keys unrecorded, plain values only, a process-wide anonymous stream count

Status: implemented (ADR-0258), accepted by the orchestrator on 2026-11-25. Amends k.schema (Primitives, Closed objects, a new Plain data paragraph, Conformance), std.sessions (Module, Conformance), std.channels (Serve, Conformance #12), adds std.channels-limits, and amends `docs/THREAT-MODEL.md` (Secrets, Sessions, State in the page, Event streams), the map and the std index. From fix lane 09 "pii-and-data" of the P1 weakness triage (backlog 0977, 0980, 0973, 0748).

## For the operator
1. **Not declared, not recorded (0977).** A session records store state, `tx` payloads and route values as their schema encodes them, so a key an open object does not declare is dropped, not marked. Recommended: yes. A mark keeps the key, and a key can itself be personal data (an email-keyed map); dropping is what `encode` already does, and an author who wants the key recorded declares it.
2. **Plain data everywhere, not only under undeclared keys (0980).** The triage said "refuse non-JSON values there". The same hole stands at a declared position (`s.object({})` accepts a `Map` today, whose entries hold anything), so an `object`, `record` or `union` node also refuses a value that is not a plain object, and an `array` node one that is not a plain array; `s.json()` takes the same definition. The cost is that a class instance at an object position no longer parses. Recommended: yes; reverse to the narrow form by dropping the declared-position bullet.
3. **One knob for anonymous streams (0973).** `perAnonymous` keeps its name and default, and counts every module's cookieless channel streams in the process; each module's value bounds opens on its own routes, so the process holds at most the largest value. No new config key.
4. **The cookie-minting client stays a stated limit.** A caller cookie is set on any write, so per-caller caps do not stop a client that makes writes; Keel counts no address, and the threat model already names the proxy as the place for per-address limits.

## Decisions
- D1 (0977): std.sessions records schema-backed values as encoded; an undeclared key of an open object, at any depth, and all under it, is not recorded. Unencodable is `null`. Declaring the key is the one way to record it.
- D2 (0977): the strings, numbers and keys under an undeclared key of a `.pii()`-marked open object are dropped from later error text and `data`, as matched values are.
- D3 (0977): a recording is redacted once, in the browser. The server's log scrub (RFC 0230) covers log records only; `sessions.ingest` redacts nothing. Stated, not changed.
- D4 (0980): k.schema defines plain data and every value `parse` accepts is plain data but for the `Secret` at each `secret` node. A violation is a parse failure, rule `type`, at the path of the offending value; no new rule name and no check-time diagnostic (the values exist only at run time).
- D5 (0973): `perAnonymous` counts process-wide; `perCaller` and `maxStreams` stay per module; the 65th anonymous open gets `closed` `full`. New section std.channels-limits, since std.channels stands at 3,074 tokens.
- D6 (0748): the threat model already names `keys`; it gains what a key in `#k-state` can and cannot do. `openHub`'s copy of `restore`'s key fallback is a code duplication, not a weakness: builder's work.

## Problem
- 0977: `redact` (`packages/std-sessions/src/redact.ts`) copies an object's undeclared key as is (`f === undefined ? x : walk(...)`), never matching it against a path, never hiding it in strings mode and never passing it to `found`. `tx` payloads escape this, because `jsonOf(e.payload, schema)` encodes them first and `encode` drops undeclared keys. Store state does not: `recording.ts` calls `jsonOf(st.snapshot().state)` with no schema, so a store holding `{ profile: { email } }` under an open `profile` records the email, though `piiPaths` lists `profile.*` for a marked `profile`.
- 0980: `scanExtras` (`packages/schema/src/internal/scanExtras.ts`) walks `Object.entries` and refuses a `Secret` or a prototype key; a `Secret` in a `Map`, a `Set`, under a symbol key or a non-enumerable key passes. `seal`'s spread of an open object copies enumerable symbol keys into the parsed value. At a declared position `isRecord` accepts any prototype, so `s.object({})` accepts a `Map`. `isJson` ignores symbol keys, non-enumerable keys and getters. Every walk downstream (`encode`, `piiValues`, the server log's value set, `redact`, `#k-state`) reads own enumerable string keys, so such a value is invisible to all of them.
- 0973: `full` (`packages/std-channels/src/server/internal/full.ts`) skips sinks of other modules, so with N serving modules cookieless clients hold 64·N streams; at 16 modules that is past `createApp`'s default `maxStreams` of 1,000, and every live-loader open in the app is then 503.
- 0748: THREAT-MODEL State in the page names `keys` (the `{ name, key }` of a store's latest keyed commits). Write keys are idempotency keys, not cryptographic: a `tx` whose store `keys` holds its name and key commits nothing (k.sync). `openHub` (`packages/std-sessions/src/group/internal/openHub.ts`) rebuilds `keys` from log entries in `snapshots()`, copying `store.ts`'s `restore` fallback; it derives nothing from public values.

## Proposal
### Clause 1: the recording holds no undeclared key (0977), std.sessions
- Store state, `tx` payloads and route `params` and `search` are recorded as their schema encodes them; no schema (a route without one), as given; a value its schema does not encode, `null`. So no key an open object leaves undeclared, at any depth, nor anything under it, is in the session. To record a key, declare it: a field, or an `s.record` for keys not known ahead.
- Each undeclared key of a `.pii()`-marked open object in the value as held, and each non-empty string and number under it, is dropped from later error messages and `data` as redacted values are (the newest 256 distinct, which the spec now states for redacted values too).
- A recording is redacted once, at capture. `sessions.ingest` recomputes `error` and `fingerprint` and redacts nothing; the server log's marks (k.privacy Sinks, RFC 0230) cover `diag` and `req` records, not a filed session or what `sessions.list` returns.
- Protection (#20): for every state and payload schema with open objects and every value with undeclared keys added at depths 1 to 3, the session JSON holds none of the added keys or strings, and its state and payload still parse. Pinned by #21 (a record key is recorded, an open object's is not), #22 (error text), #23 (ingest does not redact).
- Replay: the base state parses (an open object without its extra keys is valid). A run whose behaviour depends on an undeclared key may not reproduce, which E2004 reports.

### Clause 2: plain data (0980), k.schema
- Definitions: a plain array (`Array.prototype`, own keys `length` and each index, each holding a value) and a plain object (`Object.prototype` or `null` prototype, string keys other than the three prototype keys, each property enumerable and a data property). Plain data: `null`, boolean, string, finite number, or a plain container of plain data with no cycle.
- `json` accepts exactly plain data (rule `type` at the node's path).
- Under an undeclared key of an open object, each value reached through plain containers that is not a primitive of plain data or a plain container, and each container met inside itself, is rule `type` at its path; nothing under it is read. The existing `Secret` rule (#15) is one case of it.
- At a declared position, `object`, `record` and `union` nodes require a plain object and `array` a plain array, each element judged by its own node; rule `type` at the container's path.
- The consequence, stated as the clause the walks rely on: a parsed value is plain data but for the `Secret`s at `secret` nodes, and every value in it is reached by own enumerable string keys and array items.
- Limits stated: a Proxy is judged by what its traps answer while `parse` reads it; `parse` without a `secret` node returns the given value, so a later mutation is not judged.
- When: at parse, as a `SchemaError` issue; `encode` of such a value throws, as for any invalid value.
- Protections: #17 (each of fifteen non-plain values at an undeclared key, nested, and in `s.json()`), #18 (plain values pass), #19 (declared positions and the root), #20 (property: adding a non-plain value under an undeclared key fails at its path), #21 (property: every value reached by `Reflect.ownKeys` is reached by enumerable string keys).

### Clause 3: a process-wide anonymous count (0973), std.channels-limits
- Numbers: `perCaller` 8 per caller per module; `perAnonymous` 64, counted over every module's channel routes in the process, each module's value bounding opens on its own routes; `maxStreams` 1,000 per module. `createApp({ maxStreams })` (1,000, every live loader) is unchanged.
- An anonymous client is caller `""`: no caller cookie, or one that does not verify. Keel counts no address: a client rotating addresses shares the one count and gets no more.
- The 65th cookieless open gets `{ kind: 'closed', reason: 'full' }` as its only event; `subscribe` backs off 1 s doubling to 30 s.
- Stated limits: the cookieless places are shared, so a flood makes every other cookieless open full, a real visitor's among them; streams with a caller keep every place the flood cannot take (at most the largest `perAnonymous`). Signed-in streams are counted by caller, not by `user`, and not apart from other callers. A client that makes writes mints a caller per cookie; only the module and app `maxStreams` bound it, and the proxy is where per-address limits go.
- Protections: std.channels-limits #1 to #3 and the property #4 over sequences of opens and ends.

### Clause 4: write keys in `#k-state` (0748), THREAT-MODEL
What `keys` holds: the `{ name, key }` of a request store's latest `keyLimit` keyed commits, for a store an island needs. What a client can do with one: in its own browser, a `tx` of that name and key commits nothing. On the server a key is checked only against the `keys` of the store the write commits to, and no server store restores from `#k-state` (factory stores never enter it, k.leave), so a key read from a page suppresses a server write only where that server store already holds the same transaction with that key. std-offline write keys are `ctx.random.id('Write')` (a random UUID on a real ctx). No forgery path: no key in Keel is derived from a value the page holds. Applied to `docs/THREAT-MODEL.md`.

## Builder's work, no spec change
- 0748 `openHub`: expected: `snapshots()` returns each stored snapshot with `keys` exactly as `restore` reads them. Sentence it already holds to: k.sync Write key, "`restore` sets it (a snapshot without it: its log entries' keys)". Fix: move the fallback into one function in `@keel/store/internal` (`snapshotKeys(snapshot)`), used by `store.ts`'s `restore` and by `openHub`; a unit test in `packages/std-sessions/test/` that a stored snapshot without `keys` gives the same `keys` through `snapshots()` as through `restore`.
- 0977's `tx` path is already right where `encode` succeeds; the builder replaces `jsonOf`'s fallback to the raw value by `null` (Clause 1).

## Alternatives
- **0977: keep undeclared keys with a redaction mark** (`[pii]` or a generated value). The key stays, and keys carry personal data; the recording then differs from what `encode` writes everywhere else. Rejected.
- **0977: drop only a marked open object's undeclared keys.** An unmarked open object's undeclared data is as unknown to the author; one rule is simpler and safer.
- **0980: state the limit instead.** The triage decided to refuse; a stated hole in "a secret never serializes unseen" is the claim a tester attacks first.
- **0980: a new rule `not-plain`.** `Rule` is closed and `type` already reports a `Secret` there; one more name buys nothing a path does not say.
- **0973: a new process-wide key (`anonymous`).** Two numbers for one population; a module's own value bounding its own routes gives the same total with no new key.
- **0973: count by client address.** Keel does not see a trustworthy address behind proxies; a wrong address count is worse than none.

## Spec diff
Applied in this commit. Status `implemented` (accepted, conformance owed) on k.schema (map), std.sessions, std.channels and the new std.channels-limits (std index), each from `conformance-covered`.
- k.schema: `json`'s gloss; Closed objects' open-object sentence; Plain data (new paragraph); Conformance #17 to #21.
- std.sessions: Module (encoded recording, the 256 bound, marked undeclared values in error text, redacted once); Conformance #20 to #23.
- std.channels: the caps sentence moves to std.channels-limits; Conformance #12 says what each module counts alone.
- std.channels-limits: Config, What the caps bound, Limits, Conformance #1 to #4.
- No new diagnostic code; no glossary term.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/schema/conformance/plain-data.test.ts`: k.schema#17 to #21. `json.test.ts` (#12) and `secret-under-undeclared-key.test.ts` (#15) stand; the writer confirms neither asserts a now-refused value parses.
- `packages/std-sessions/conformance/record-undeclared.test.ts`: std.sessions#20 to #23.
- `packages/std-channels/conformance/limits-anonymous.test.ts`: std.channels-limits#1 to #4. `per-module.test.ts` re-quotes std.channels#12; `per-anonymous.test.ts` (#11) stands.

## Migration
None. No app is released. The builder runs the suites of every package that parses class instances through `s.object` or `s.record` (`git grep` for `new ` values passed to `.parse(` in `packages/*/src`) and makes each value plain.

## Token impact
- Spec: k.schema +1,030 to about 2,680; std.sessions +445 to 3,099; std.channels −66 to about 3,010; std.channels-limits new, about 1,050. All within 3,100.
- `keel docs` map: one row; `docs.map` re-based 1,600 to 1,620.
- Bytes: `@keel/schema` one shape test per container in `check` (`Reflect.ownKeys`, descriptors); `@keel/std-sessions` and `@keel/std-channels` a few lines. Measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text, threat model, budget. 2. `conformance-writer`: the fourteen clauses. 3. Build:
- `packages/schema/src/internal/`: `isPlainArray.ts`, `isPlainObject.ts` (new); `isJson.ts` and `scanExtras.ts` use them; `check.ts`'s `object`, `record`, `union` and `array` cases test the container shape on the value as given, before `seal` copies it (`make.ts`: judge the input's own descriptors first, so a getter or a non-enumerable key is refused rather than flattened or dropped by the spread).
- `packages/std-sessions/src/internal/recording.ts` (state through `jsonOf(state, st.schema)`), `jsonOf.ts` (unencodable: `null`), `redact.ts` (an object node drops undeclared keys), `redactionOf.ts` (`found` over a marked open object's undeclared keys and values, read from the value as held).
- `packages/std-channels/src/server/internal/full.ts`: the cookieless count over every sink of the hub; `ChannelsConfig.ts`'s doc.
- `packages/store/src/internal/snapshotKeys.ts` (new) and `openHub.ts` (0748).
- Docs: the `keel-compliance` and `keel-data` skills, READMEs of `@keel/schema`, `@keel/std-sessions`, `@keel/std-channels`, a changeset, `tasks/BACKLOG.md` (all four lines).
