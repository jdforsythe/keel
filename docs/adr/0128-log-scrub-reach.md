# ADR-0128: every `Secret` made while a request runs joins that request's `[secret]` log scrub, through an internal listener in `@keel/schema` and an `AsyncLocalStorage` scope in `@keel/server` (RFC 0105)

**Status:** accepted (user, 2026-11-16: the hook as proposed, booleans unmarked, no length rule; secrets made outside a request left to RFC 0105 Questions 1).

**Context.** Before a `diag` record is written, the server replaces each value in the request's `secrets` set with `[secret]` in its message and frames. Only two values entered that set, each added by hand: the revealed secrets of the decoded action input (`runAction`) and the revealed `bearer`. A `Secret` parsed later in the request, by a loader after an `await` or by `credentials(ctx).mint` of `@keel/std-credentials`, was logged verbatim in dev and production; two expected-failure tests in `packages/server/test/secretScrubReach.test.ts` reproduce it. Every `Secret` is constructed in one place, `Secret.of` in `@keel/schema`, reached by `parse`, `decodeStrings` and `gen`. The request's reactive scope is synchronous (a store made after an `await` has no owner), so it cannot say which request a later secret belongs to. `@keel/server` runs only on the `node` adapter and already imports `node:` modules; `@keel/schema` imports none and ships to the browser and to shells. k.privacy was at 1,497 of 1,500 tokens.

**Decision.**
- D1: one mechanism. Each `Secret` constructed while a request runs adds its revealed strings and numbers (`secretValues`) to that request's `secrets` set: the input, `bearer`, a later parse, a minted token.
- D2: `@keel/schema/internal` exports `onSecret(listener: (made: Secret<unknown>) => void): () => void`, one slot that `Secret.of` calls with each new secret; a second call replaces the first; the return clears it. No public export and no k.schema sentence. `@keel/schema` gains no `node:` import.
- D3: `@keel/server` holds one module-level `AsyncLocalStorage<Set<string>>`. `createApp` installs the listener once per process; each request builds its scope and runs `handle` inside `run(secrets, ...)`; runners start under `exit`. Outside a request the listener finds no store and adds nothing.
- D4: the hand-written adds in `runAction` and for `bearer` are removed; the hook covers both.
- D5: a boolean secret stays unmarked, and `scrubbed` keeps its one rule for short values (whole token under 3 characters).
- D6: `diag` records are scrubbed with the set as it stands when the request's handler settles; the dev response cause is scrubbed at the throw.
- D7: k.privacy Sinks says it in one sentence pair; the section trims its own duplicate text and merges two conformance bullets to stay at 1,498 tokens. k.server, k.schema, k.api and k.reveal are unchanged.
- D8: secrets made outside a request (startup config, runners, jobs) are not built here; RFC 0105 Questions 1 recommends a run-scoped set per runner, backlog 0654.

**Alternatives.**
- A collector passed through `ctx`. Rejected: every `parse` site, std packages included, would need the ctx, and a missed site is silent.
- One process-wide set marking every record. Rejected for requests: one request's secret would mark another's records, and the set grows without a cap.
- Documenting the gap. Rejected: logs are redacted by default (WORKFLOW RFC default 4), and the kernel enforces where it can (default 6).
- Keeping the hand-written adds beside the hook. Rejected: two ways to fill one set (default 2).
- Marking booleans, or a length rule. Rejected by the user.

**Consequences.**
- A loader's parse, a token minted after an `await`, a helper's parse in another file, the input and `bearer` are all marked in the request's log records by one path. `secretScrubReach.test.ts` loses its two expected failures.
- App code, types and imports do not change; no error code is added.
- Two overlapping requests keep separate sets; an in-process peer request has its own.
- A short numeric secret also marks matching whole-token numbers, a line or column in a frame among them, and a secret equal to a common word marks that word. Readability only.
- `@keel/schema` grows about 40 B gzip; `@keel/server` about 120 B, with a re-base to 21kb if RFC 0104's work leaves it over 20.25kb. On Node 22 the first `AsyncLocalStorage` turns on async context tracking for the process; the server lane measures the cost.
- A secret made at startup, in a runner or in a job is still in no set, and a runner's `runner rejected` line has no scrub pass, until RFC 0105 Questions 1 is decided.
