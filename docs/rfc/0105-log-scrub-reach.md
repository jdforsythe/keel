# RFC 0105: log scrub reach (every `Secret` a request makes joins its `[secret]` set)

Status: accepted and built (user, 2026-11-16: the hook as proposed, booleans unmarked, no length rule); for backlog 0628 and 0642. Design in `tasks/0338-s8-reach/proposed/server-scrub.md`. Each decision cites the WORKFLOW RFC default it applies or names the user's accepted choice; what is left open is under Questions with a recommendation. ADR-0128 records it.

## Decisions
- D1 (the user's accepted choice): one mechanism covers every `Secret` a request makes. The server log's `[secret]` pass reads the request's `secrets` set; today only the decoded action input and `bearer` are added to it, by hand. After this RFC each `Secret` constructed while the request runs adds its revealed strings and numbers to that set: the action input, `bearer`, a loader's or action's parse after an `await`, a token from `credentials(ctx).mint` of `@keel/std-credentials`. The kernel does not import `@keel/std-credentials` and does not need to: `mint` makes its token with `s.secret(s.string()).parse`, which is the one construction point (default 4: what lands in a log is redacted).
- D2 (the user's accepted choice): `@keel/schema/internal` gains `onSecret(listener)`, one listener slot that `Secret.of` calls with each new `Secret`. It is internal: no export from `@keel/schema`, no k.schema sentence, nothing an app author sees or imports. The listener receives the `Secret` itself, not its raw value: `secretValues` opens secrets it finds under a value, so a raw string would give it nothing, and the raw value never leaves `Secret.ts` through a callback.
- D3 (the user's accepted choice): `@keel/server` keeps one module-level `AsyncLocalStorage<Set<string>>` from `node:async_hooks`. `createApp` installs the listener once per process. Each request runs its scope construction and `handle` inside `run(secrets, ...)`, so an `await`, a timer or a promise chain started by the request keeps its set. Runners start under `exit`, so no runner ever inherits a request's set. `@keel/schema` gains no `node:` import and no platform check, so the client bundle and shells are unchanged.
- D4: the two hand-written adds go. `runAction`'s `for (const v of secretValues(decoded.value)) rq.secrets.add(v)` and RFC 0104's add of the revealed `bearer` are both covered by the hook, since the input is decoded and the header is parsed inside the request's scope. Keeping either would be a second way to fill the same set (default 2: one way per thing).
- D5 (the user's accepted choice): a boolean secret stays unmarked, and `scrubbed` keeps its one length rule (a value under 3 characters is replaced only as a whole token). The set takes what `secretValues` gives: non-empty strings and numbers as `String()` writes them. Marking `true` or `false` would mark every boolean in the record, or, marking only the value made, show which one it was.
- D6: ordering. A `diag` record's message and frames are scrubbed when the request's handler settles, with the set as it stands then, so a secret made after a throw but before the response (a second loader running beside the one that threw) still marks the record. The `keel.unexpected` cause that `scrubbedCause` clips for the dev response is scrubbed at the throw, with the set as it stands at that moment. A secret made after the request's records are written marks nothing (default 4, as far as one request's set reaches).
- D7: spec placement. The scrub's reach stays in k.privacy Sinks, Server log bullet; k.server, k.schema, k.api and k.reveal are unchanged. k.privacy stays under 1,500 by trimming its own duplicate text and merging its two `[secret]` conformance bullets (Spec diff), and goes from 1,497 to 1,498 tokens (default 2: one section owns the rule).
- D8: secrets made outside any request (startup config, a runner, a job, which runs in a runner) are not built here. The request path is built now; the outside-a-request case is Questions 1, the user's, with a recommendation and backlog line 0654.
- D9: budgets. `@keel/schema` grows about 40 B gzip of its 360 B of room. `@keel/server` is 38 B over 20.25kb today, while RFC 0104's server lane is in progress; this RFC adds about 120 B and removes two lines. If the lane measures it past the limit after RFC 0104 lands, it is re-based to 21kb (21,504) with the reason in the commit (default 7).

No public API changes. No error code is added. `secretValues`, `redacted`, `scrubbed` and `scrubbedCause` keep their signatures.

## Problem
Measured on `jdforsythe/test-impl` at `5e2c29d9`, reading `packages/schema/src/Secret.ts`, `packages/schema/src/internal/seal.ts`, `packages/server/src/createApp.ts` and `packages/server/src/internal/runAction.ts`.

**What the scrub reads.** `createApp`'s `routed` builds the request scope with `secrets: new Set<string>()`. `runAction` adds `secretValues(decoded.value)` to it after the input is decoded. RFC 0104's server lane adds the revealed `bearer`. When `handle` settles, `routed` replaces each value in the set by `[secret]` in every `diag` message and frame (`redacted`, then `scrubbed`: as written, `encodeURIComponent`, JSON escaping and base64, case-insensitive, longest first). Nothing else enters the set.

**Where a `Secret` is made.** One place: `Secret.of` in `packages/schema/src/Secret.ts`. It is reached by `seal` (every `s.secret(inner).parse` and `decodeStrings`, a nested secret sealed before its parent) and by `gen`. `s.secret(...).parse` of an existing `Secret` returns it and makes nothing. `credentials(ctx).mint` makes its token with `s.secret(s.string()).parse`, and `bearerOf` parses the header with the same schema.

**Reproduction 1, a loader's parse** (`packages/server/test/secretScrubReach.test.ts`, "a secret a loader parses is marked in that loader's diag", `it.fails` today). A loader awaits once, parses `"api-key-91c2e7d40b"` with `s.secret(s.string())` and throws `Error("upstream refused " + reveal(key))`. The `diag` line is `loader app.a threw: Error: upstream refused api-key-91c2e7d40b` in production. The value is in no set.

**Reproduction 2, a token made after an `await`** (same file, "a token the action makes after an await is marked", `it.fails` today). An action awaits once, parses `"keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0"` (the shape a sim `mint` gives) and throws `Error("mailer down; token " + revealed)`. The line holds the token verbatim, and so does the dev response body.

**What already holds.** The same file pins two cases that pass with no code change: a revealed input secret in a frame path logs as `modules/[secret]/a.server.ts:3:7`, and a boolean secret's value is logged as `true`, since `secretValues` gives no boolean.

**Why a syntax rule does not reach it.** E1112 (k.reveal) reports `throw new Error(reveal(k))` in the file it reads. A throw through a helper, an import, or a library that puts its argument in an error message passes E1112 and reaches the log line. The runtime scrub is the half that reaches those, and today it reaches only the input.

## Proposal

### API
All of it is internal. Package names, entries and files:

`@keel/schema` (first in `tooling/deps.json` order; imports no package and no `node:` module):

```ts
// packages/schema/src/internal/SecretListener.ts
import type { Secret } from "../Secret.ts";
/** Called with each `Secret` as it is made (`Secret.of`); never with a raw value. */
export type SecretListener = (made: Secret<unknown>) => void;

// packages/schema/src/internal/listening.ts
import type { SecretListener } from "./SecretListener.ts";
/** The one listener slot `Secret.of` reads; `undefined` when nothing listens. Written only by `onSecret`. */
export const listening: { current: SecretListener | undefined } = { current: undefined };

// packages/schema/src/internal/onSecret.ts
import { listening } from "./listening.ts";
import type { SecretListener } from "./SecretListener.ts";
/**
 * Make `listener` the one function `Secret.of` calls with each new `Secret`, replacing any earlier one. The returned
 * function clears the slot if `listener` still holds it. Not app-facing: `@keel/server` reads it to scrub a request's
 * secrets from its log.
 */
export function onSecret(listener: SecretListener): () => void {
  listening.current = listener;
  return () => {
    if (listening.current === listener) listening.current = undefined;
  };
}

// packages/schema/src/Secret.ts, the one changed method
static of<T>(value: T): Secret<T> {
  const made = new Secret(value);
  listening.current?.(made);
  return made;
}
```

`packages/schema/src/internal/index.ts` re-exports `onSecret` and the type `SecretListener`. `listening` is not re-exported. `Secret.ts` imports `listening.ts`, which imports only a type, so no import cycle exists at run time. One export per file holds (PRINCIPLES 3). The `.` entry bundles `listening` and the optional call; `onSecret` is in `./internal` only.

`@keel/server` (after `schema` in `tooling/deps.json`; already `platform: "node"` in `tooling/budgets.json` and already imports `node:fs`, `node:path`, `node:module` and `node:url` statically):

```ts
// packages/server/src/internal/requestSecrets.ts
import { AsyncLocalStorage } from "node:async_hooks";
/** The revealed secrets of the request whose code is running (k.privacy Server log); none outside a request. */
export const requestSecrets = new AsyncLocalStorage<Set<string>>();

// packages/server/src/internal/noteRequestSecrets.ts
import { onSecret, secretValues } from "@keel/schema/internal";
import { requestSecrets } from "./requestSecrets.ts";
let noting = false;
/**
 * Once per process: each `Secret` made while a request runs adds its revealed strings and numbers (`secretValues`)
 * to that request's set. A `Secret` made outside a request adds nothing.
 */
export function noteRequestSecrets(): void {
  if (noting) return;
  noting = true;
  onSecret((made) => {
    const into = requestSecrets.getStore();
    if (into !== undefined) for (const v of secretValues(made)) into.add(v);
  });
}
```

In `createApp`: `noteRequestSecrets()` near the top. `routed` becomes, in outline:

```ts
const routed = () => {
  const secrets = new Set<string>();
  return requestSecrets.run(secrets, async () => {
    const rq = { scope: scope(() => undefined), caller: ..., bearer: bearerOf(raw), ..., pii: new Set<string>(), secrets };
    isolate(rq.scope);
    const r = await attempt(() => handle(sv, raw, rq, c));
    // unchanged: dispose, then each diag's message and frames through redacted(..., rq)
  });
};
```

The runner start becomes `requestSecrets.exit(() => own.flatMap(...).map((r) => keepRunning(...)))`, so a runner's promise chain carries no store even when `createApp` is itself called inside another app's request (an in-process peer).

`runAction` loses its `secretValues` import and the add line. The `bearer` add RFC 0104's lane wrote is removed wherever it landed (`createApp` or `handle`). `RequestScope`'s doc comment says `secrets` holds "the revealed value of each `Secret` made while the request runs (`noteRequestSecrets`)".

### Registered once, and its cost outside a request
`noteRequestSecrets` sets a module flag, so a test file that creates fifty apps installs one listener. Two copies of `@keel/schema` in one process would each have a slot; the workspace resolves one copy, so a second copy is a Known limit, not a design case. With no listener (the browser, a shell, a test without `createApp`), `Secret.of` pays one property read and one `undefined` check. With the listener and no request (startup, a runner), it pays one function call and one `getStore()` that returns `undefined`. Inside a request it pays `secretValues` of the new secret, a walk of one value, and one `Set.add` per string or number.

### Why `AsyncLocalStorage`
The two reproductions both make the secret after an `await`. The request's reactive scope (`isolate`, `inRequest`, k.store) is synchronous by design, so a store created after an `await` has no owner (E1203); the same rule would miss both cases. A set passed through `ctx` would need every `parse` site to have the ctx (Alternatives). `AsyncLocalStorage` follows the request's own promise chain, timers and callbacks with no change to app code or to any signature.

It is in `node:async_hooks` on Node 22 and later (the `engines` floor), Bun and Deno. `@keel/server` already runs only where `node:` modules load: the `node` adapter (k.topology). The `client` and `static` adapters and both shells (k.shell) package client code and never load `@keel/server`, so they gain nothing, and `@keel/schema` keeps no platform code: the slot is a plain object, filled only by a caller that has the import. No fallback is written. A runtime with no `node:async_hooks` already fails at `@keel/server`'s `node:fs` import.

### Sim and shell ctx
A sim ctx (k.sim) changes clocks, randomness and the network, not where code runs. `createApp` under a sim ctx runs in Node and gets the same scope; a sim `fetch` that "runs the route" calls the app in process, which enters its own `run` for that request. `renderRoute` and `render` from `@keel/testing` do not call `createApp`, write no server log and are unchanged. A shell ctx runs in a packaged client and has no server log.

### Concurrency and nesting
Two overlapping requests each run in their own `run`, so each set holds only that request's secrets; the conformance case below checks it. A request that calls an in-process peer (`service({ module })` with both deployables in one process, or a sim fetch) enters a nested `run` for the peer's request: secrets the peer makes go to the peer's set and log, and the caller's set is restored when the call returns. A value the peer reveals into an `s.string()` field and the caller parses again with `s.secret` is made again inside the caller's scope and joins the caller's set.

### Jobs
`enqueue` of `@keel/std-jobs` writes a row; a job input refuses a `Secret` (E2503), so no secret crosses from a request to a job. The job runs later in its module's runner, outside any request, so a `Secret` it makes is in no set and its `runner rejected` diag, written by `createApp`'s `failed`, has no scrub pass today. This is Questions 1.

### Ordering in detail
- `scrubbedCause` runs at the throw: the `keel.unexpected` cause in the dev response body and dev panel is scrubbed with the set at that moment. The secret a reproduction throws was made before the throw, so it is marked there too.
- The `diag` records are scrubbed after `handle` settles, with the final set.
- A secret made after `handle` settles (a promise the request left running) adds to a set nothing reads; the set is freed with the last closure that holds it.
- A live loader's event stream writes no `diag` after its response starts (`liveStream` returns `diags: []`), so a secret its generator makes later has no record to mark.

## Alternatives
- A per-request collector passed through `ctx`. Rejected: every `parse` site would need the ctx, including `s.secret` schemas inside helpers and std packages that never see one, and `credentials(ctx).mint` would have to know about a kernel log. A missed site is silent.
- Marking every `Secret` process-wide (one set for every record). Rejected for the request path: a secret one request makes would mark another request's records, which shows that the value occurred elsewhere, and the set grows for the life of the process unless capped. It is the shape Questions 1 weighs for secrets made outside a request, capped.
- Doing nothing and documenting it. Rejected: the threat model says logs are redacted (default 4), the reproductions show a token verbatim in a production log, and documentation of a leak does not stop it (default 6: kernel enforcement over documentation).
- Keeping the hand-written adds beside the hook. Rejected: two ways to fill one set (default 2), and the hook already covers both.
- A boolean mark, or a minimum length beyond the whole-token rule. Rejected by the user's choice (D5).

## Spec diff
Token counts are `Math.ceil([...text].length / 4)` of the whole file, measured on a scratch copy of `spec/kernel/k.privacy.md` at `5e2c29d9`, after RFC 0104's spec commit. Before: 5,987 characters (1,497). After: 5,992 characters (1,498).

### k.privacy (1,497 to 1,498)
**Purpose**, the sentence "A secret never serializes." is removed. **Secrets** states it with its forms in the next paragraph.

**Secrets**, the sentence "A credential is kept as a value derived from it in server code: `credentials(ctx)` of `@keel/std-credentials` hashes and verifies a password `Secret` (std.credentials) and mints and checks tokens (std.tokens)." becomes:

> `credentials(ctx)` of `@keel/std-credentials` keeps a credential as a hash (std.credentials) or a token digest (std.tokens).

**Sinks**, Server log bullet, the two sentences "The revealed value of each `Secret` in the decoded action input is replaced by `[secret]` the same way. An action's `output` counts as a loader's, and `bearer` (k.api) as a `Secret` input." become:

> So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: a string or a number, not a boolean. One made at startup or in a runner is not. An action's `output` counts as a loader's.

**Conformance**, the bullet "An action throwing the revealed value of a `Secret` input, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production." becomes:

> - An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await`; a boolean secret logs as is; of two overlapping requests each marks only its own.

and the bullet "An API action throwing the revealed `bearer` logs `[secret]` in its place." is removed (it is in the bullet above).

No conformance file quotes the removed Purpose sentence or the replaced credentials sentence (checked with `grep -rn` over `packages/*/conformance` and `packages/*/test`).

### Unchanged
- k.server (1,494): its Log paragraph says personal data is dropped per k.privacy; it names no reach.
- k.schema (1,268): `s.secret` parses, encodes, generates and documents as before; an app author's code and types do not change. `onSecret` is internal and has no sentence.
- k.api (1,465): "The token is a `Secret` before app code runs (k.privacy)." stays true: `bearerOf` runs inside the request's scope, so the hook adds it.
- k.reveal (1,073), k.ctx (1,434), k.sim (1,240), k.shell, k.topology.

## Conformance diff
Written by `conformance-writer` in the `rfc:0105` PR, from the Spec diff only.

**`packages/server/conformance/privacy-diag-scrub.test.ts`** (changed). Header line 3 quotes the old Sinks sentence and the old Conformance bullet. It becomes:
`// Spec: k.privacy, Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: a string or a number, not a boolean." Conformance "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, ..."`
Its cases (generated input schemas, the action throwing each revealed secret as a string and in an `Error`, in dev and production, no line holding the value, its base64 or `encodeURIComponent` form) are unchanged: the decoded input is made inside the request's scope, so the hook covers what the removed `runAction` line did. The `it` names that quote the old bullet are updated to the new wording.

**`packages/server/conformance/bearer-0104.test.ts`** (changed). Header line 11 quotes "An action's `output` counts as a loader's, and `bearer` (k.api) as a `Secret` input." and line 12 "An API action throwing the revealed `bearer` logs `[secret]` in its place." Both become quotes of the new text: Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`" and the merged Conformance bullet. The scrub case (`it` at "An API action throwing the revealed `bearer` logs `[secret]`...", dev and production, token `ab+c/d-e.f_g~h==` in all four forms) keeps its assertions; its name quotes the new sentence. It now passes through the hook, since `bearerOf` runs inside `run`.

**`packages/server/conformance/privacy-secret-reach.test.ts`** (new). Header quotes the new Sinks sentences ("So is ...", "One made at startup or in a runner is not.") and the merged Conformance bullet. One app, `createApp` with a sim ctx (seed 1337), `artifacts` set, `log: { format: "json", write }`. Cases:
- A loader that awaits once, parses `"api-key-91c2e7d40b"` with `s.secret(s.string())` and throws `Error("upstream refused " + reveal(key))`: a document GET in production logs `loader app.a threw: Error: upstream refused [secret]`, and no line holds the key in any of the four forms.
- An action that awaits once, parses `"keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0"` and throws `Error("mailer down; token " + revealed)`: in dev and production the line is `action app.a threw: Error: mailer down; token [secret]`; in dev the JSON response body does not hold the token either.
- The same throw where a helper in a second app file, called after two `await`s, makes the secret: marked (the scope follows the call chain, not the file).
- Input `{ flag: s.secret(s.boolean()) }`, sent `{ flag: true }`, the action throwing `Error("flag " + String(reveal(flag)))`: the line is `action app.a threw: Error: flag true`.
- Two overlapping POSTs, each parsing its own secret (`"alpha-7c1e3f"`, `"bravo-2d9a6b"`) after an `await` on a sim clock deadline that makes them interleave, each throwing an `Error` whose message holds its own value and the other request's value as a string literal: each request's line marks its own value and holds the other's as written.
- A `Secret` parsed at module scope before `createApp` and thrown revealed by an action: the line holds the value as written (the "One made at startup ... is not" sentence; this case flips if Questions 1 is decided otherwise).
- A runner that parses a secret and rejects with its revealed value: the `runner rejected` line holds it as written.

No `packages/schema/conformance` file changes: no spec sentence about `s.secret` changes. `onSecret` is covered by unit tests in the schema lane.

## Lanes and build order
Written for agents who have read only this RFC. RFC 0104's lanes that touch `packages/server` land first; this RFC's server lane starts from that tree. Machine rules for every lane: one test file at a time (`perl -e 'alarm 300; exec @ARGV' pnpm --filter <pkg> exec vitest run <file> --reporter=dot 2>&1 | tail -20`), every command bounded, no watch mode, no process left running. No lane edits `spec/**`, `tooling/budgets.json`, `tooling/deps.json`, `tasks/BACKLOG.md` or `docs/HANDOFF.md`; the orchestrator owns them.

### Lane 1. Orchestrator: spec (one commit, `rfc:0105 spec`)
Apply the Spec diff to `spec/kernel/k.privacy.md` exactly. Measure with `Math.ceil([...text].length / 4)`: 1,498. `pnpm spec k.privacy | tail -n +4` prints it.

### Lane 2. `conformance-writer` (the `rfc:0105` PR)
Owns `packages/server/conformance/privacy-diag-scrub.test.ts` (header and `it` names only), `bearer-0104.test.ts` (header lines 11 and 12 and the scrub case's name only) and the new `privacy-secret-reach.test.ts`, from the Conformance diff. Reads the spec, not the implementation. Verification: each of the three files alone; before lane 4 lands the new file's marking cases fail and the two changed files pass.

### Lane 3. Schema lane: one agent, `packages/schema` except `conformance/`
Files: `src/internal/SecretListener.ts`, `src/internal/listening.ts`, `src/internal/onSecret.ts` (new), `src/internal/index.ts` (re-export `onSecret` and type `SecretListener`, and the comment line naming `@keel/server`'s use), `src/Secret.ts` (`of` calls the slot). Unit test `test/onSecret.test.ts`: the listener gets each secret `parse`, `decodeStrings` and `gen` make, a nested secret before its parent; a parse of an existing `Secret` calls nothing; a second `onSecret` replaces the first; the returned function clears only its own listener; with no listener `parse` behaves as before. A grep check in the same test or in `pnpm check`: no `node:` import under `packages/schema/src`. Verification: `pnpm --filter @keel/schema check`, `test/onSecret.test.ts` alone, `conformance/secret.test.ts` alone, `pnpm --filter @keel/schema build`. Runs in parallel with lane 2.

### Lane 4. Server lane: one agent, `packages/server` except `conformance/`, after lane 3
Files: `src/internal/requestSecrets.ts`, `src/internal/noteRequestSecrets.ts` (new); `src/createApp.ts` (`noteRequestSecrets()`, `routed` inside `requestSecrets.run`, `bearerOf` inside it, runners under `requestSecrets.exit`, the bearer add removed); `src/internal/runAction.ts` (the `secretValues` line and import removed); `src/internal/RequestScope.ts` and `src/internal/redacted.ts` doc comments (`secrets`: each `Secret` made while the request runs); `README.md`, the log paragraph. Tests: in `test/secretScrubReach.test.ts` the two `it.fails` become `it`, and the file's header comment says a secret the request makes after its input is marked; a new case there for an in-process nested request (a peer's secret marks the peer's line and not the caller's). Verification: `pnpm --filter @keel/server check`; `test/secretScrubReach.test.ts` alone; `conformance/privacy-diag-scrub.test.ts` alone; `conformance/bearer-0104.test.ts` alone; `conformance/privacy-secret-reach.test.ts` alone; `conformance/topology-runners.test.ts` and `conformance/runner-rejection-diag-0092.test.ts` alone; `pnpm --filter @keel/server build`. Measure `@keel/server` with `node tooling/budgets.mjs 2>&1 | tail -8` and report the byte count to the orchestrator. Measure 10,000 sequential `app.fetch` GETs of one route before and after, under Node 22 and the local Node, and record both in `PLAN.md`.

### Lane 5. Orchestrator, after lanes 2 to 4
`docs/THREAT-MODEL.md` Secrets bullet: "and the server writes `[secret]` in place of a request's own secret input in its log" becomes "and the server writes `[secret]` in its log in place of each secret a request makes: its input, `bearer`, a later parse, a minted token". The `keel-compliance` skill's log line, the same way. `tooling/budgets.json` re-base if D9 applies. Backlog 0628 and 0642 closed with the commit; backlog line 0654 filed (Questions 1). Ledger on a quiet tree. ADR-0128 status unchanged.

## Migration
- App code: none. No signature, type, import or rule changes. An app that relied on a secret it parsed in a loader appearing in its own production log loses that text; no golden app, template or eval does.
- Packages: `@keel/std-credentials` needs no change; its minted tokens are marked through `parse`.
- Tests: `packages/server/test/secretScrubReach.test.ts` turns its two expected failures into plain tests. Two conformance files change their quotes (Conformance diff).

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.privacy | 1,497 | 1,498 |
| k.server | 1,494 | 1,494 |
| k.api | 1,465 | 1,465 |
| k.schema | 1,268 | 1,268 |

No `keel explain` row changes.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild, minified ESM, `packages: "external"`, gzip) at `5e2c29d9`, with RFC 0104's server lane in progress in the tree.

| Entry | Limit | Today | After (estimate) |
| --- | --- | --- | --- |
| `@keel/schema` | 5.5kb (5,632) | 5,272 | about 5,310 (the slot and the optional call in `Secret.of`) |
| `@keel/schema/internal` (not budgeted) | none | 2,002 | about 2,090 |
| `@keel/server` | 20.25kb (20,736) | 20,774 (over by 38, RFC 0104 in progress) | about +120: the `node:async_hooks` import, `run`, `exit`, the listener; less two adds |

`node tooling/budgets.mjs` today fails on `@keel/server` (20,774), `@keel/services` (3,362 of 3,328) and the `check.injected10` token fixture (769 of 600), all from work in progress outside this RFC. If RFC 0104's lanes close at or under 20.25kb, this RFC may still cross it; the server lane reports the number and the orchestrator re-bases to 21kb with the reason in the commit (default 7).

## Risks
- A short numeric secret also marks numbers that are not it. A PIN `7` is a whole-token value, so a frame `a.ts:3:7` logs as `a.ts:3:[secret]` and a `7` in the message is marked. Readability only: nothing leaks, and the mark does not appear inside longer numbers. This holds today for input secrets; the hook makes it reach every secret the request makes.
- Memory per request. The set holds one entry per string or number secret made: a minted token is about 90 characters, and `scrubbed` builds four forms of each into one regular expression per record. A request that parses thousands of secrets (a bulk import of API keys) builds a large expression for each `diag`; the cost is paid only when a record is written.
- A secret value that equals a common word. A secret `"admin"` or `"true"` marks every `admin` or the word `true` in the request's records, case-insensitively. Readability only, and it shows that some secret equals that word; the same is true today for input secrets and `[pii]`.
- Promise tracking cost. On Node 22, the first `AsyncLocalStorage` turns on Node's async context tracking for the process; Node 24 uses its async context frame, which costs close to nothing. Lane 4 measures both (Lanes) and records the numbers.
- A shared promise. A module-level cache filled by request A and awaited by request B runs in A's context; a secret made inside it joins A's set, not B's. B's record holding that value is not marked.
- PRINCIPLES 2 (no action at a distance). The hook is kernel-internal: it changes no value app code reads and no behavior an app can observe except the text of its own log records.

## Known limits
- A `Secret` made outside a request (startup config, a runner, a job) is in no set, and a runner's `runner rejected` diag has no scrub pass at all (Questions 1).
- A `Secret` made before the request and only passed into it (a config value parsed at startup) is not made again, so it is not marked.
- Two copies of `@keel/schema` in one process each have their own slot; a secret made through the copy `@keel/server` does not import is not marked.
- The dev response body is scrubbed at the throw (D6); a secret a parallel loader makes after that throw is marked in the log record and not in that dev body.
- `console`, `process.stdout` and file writes never pass through the server log and are not scrubbed; E1112 reports them in the file that writes them (k.reveal).

## Questions
1. Secrets made outside a request (the user's). Startup config, a runner, a job: no set today, and runner diags have no scrub pass. Options: (a) a run-scoped set, the same `requestSecrets` store entered around each runner's `run` in `keepRunning`, with the `failed` line scrubbed by it; (b) a process-wide set that marks every record, capped at 256 values; (c) leave them unmarked. Recommendation: (a), as its own small RFC on backlog 0654, since it reuses this RFC's hook and store with one `run` per runner and gives runner and job diags the same pass a request has; (b) for startup config only if a ctx accessor for app secrets lands (RFC 0101 Questions 3), where its values would join a process set. Not built here. Backlog line to file: "0654 server: a `Secret` made outside a request (startup config, a runner, a job) is in no `[secret]` set, and a runner's `runner rejected` diag has no scrub pass; recommended: enter `requestSecrets` around each runner `run` and scrub `failed` with it (RFC 0105 Questions 1)".
2. Whether `onSecret` should hold more than one listener. Recommendation: one slot. `@keel/server` is the only reader, and a list would invite a std package to listen to every secret in the process Orchestrator's, under default 2.
3. Whether the dev response body should be scrubbed again at the end of the request (D6). Recommendation: no. It is dev only, goes to the developer who sent the request, and re-scrubbing would mean holding the response until every loader settles, which a document render already does but an event stream does not. Orchestrator's, under default 4: the log, which persists, is scrubbed with the final set.

## Amendment (2026-11-16, at the build)
- Ordering says a live stream writes no `diag` after its response starts. It writes one when its loader throws, and that `diag` is scrubbed with the request's set: the stream keeps the scope, so a secret the stream makes later is marked on its later lines.
- The timing was taken after the change only, under the local Node 24: 10,000 sequential `app.fetch` GETs of one API loader route in 144 ms. No built copy from before existed to time, and Node 22 is not installed here.
