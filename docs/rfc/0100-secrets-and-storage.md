# RFC 0100: secrets and storage (what `reveal` returns is plain data; E1112)

Status: proposed. For backlog 0257 and `tasks/0338-s8-reach/PLAN.md` D5 (c). Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0123 records it.

## Decisions
- D1: a `Secret` already cannot become durable, and this RFC adds no runtime guard. `store()` refuses `s.secret` in state (E1303), `snapshot()` folds every log entry up to the last secret payload, and a schema refuses a `Secret` in a plain or `s.json()` field. A revealed value is a plain string at run time, so neither the store nor `commit` nor a driver can refuse it. k.privacy states this once; k.store, k.persist and std.db point to it (default 2).
- D2: new E1112 (k.privacy, no fix). In app code, a value `reveal` returns may not reach an argument of `tx` or `store`, `set` or `commit` on a `storage`, a `console` method or an `Error` constructor. The rule follows the value through the same file by lexical scope, reusing `globalRefs` and the value walk E1603 already does (defaults 3, 4, 6). A call other than `String()`, `JSON.stringify()` or a method on the value ends the flow, so a hash or a ciphertext of the value passes.
- D3: the documented way to keep a credential is a derived value. Use a salted `scrypt` hash from `node:crypto` in server code, with a `ctx.random.id` salt, checked with `timingSafeEqual`. Neither the kernel nor any std package has a hash or verify helper today. A helper is a new user-facing API shape, so it goes to the backlog (Questions 1), not into this RFC (default 4 applies; the API shape is the user's).
- D4: responses are no sink. A server that shows a user a new token once returns the revealed value on purpose; ADR-0112 already keeps a submitted secret out of a re-render.
- Budget: `@keel/check` 48.25kb to 49.25kb (default 7). `@keel/store`, `@keel/schema` and `@keel/compiler` are unchanged.

New code: E1112 (k.privacy).

## Problem
Measured on `jdforsythe/test-impl` at `c7d48ec`.

**What a snapshot holds.**
- `snapshot()` is `{ state, log, initial, head }` (`packages/store/src/store.ts:209`). Each log entry is `{ id, name, payload, at, meta?, base?, key? }` (`:146-154`). `payload` is the transaction schema's own copy of what `tx` was given (`copy(payload, raw)`, `:267`). Undeclared keys are dropped and every declared value is kept as given.
- At most `logLimit` entries are kept (default 256, `internal/LOG_LIMIT.ts:6`); older ones fold into `initial` (`internal/trim.ts`).
- A server save writes `JSON.stringify(store.snapshot({ meta: true }))` per changed store (`internal/saveStores.ts:66`), through `ctx.storage.set` (`:32`). So the stored text holds state, `initial`, every kept payload, `meta`, write keys and `caller` hashes. On std.db that text is the database row (std.db On disk).

**What happens to a `Secret` today.**
- In state: `store()` throws E1303 before anything else (`store.ts:48`, `internal/secretGuard.ts:5-10`). The static half is `packages/check/src/rules/noSecretInState.ts` (a), partial by design.
- In a payload at an `s.secret` node: `copy` keeps it in memory (`internal/copy.ts:8-11`, `graft.ts:8-15`), so `log()` can `reveal` it. `snapshot()` folds every entry up to the last one holding a secret into `initial` (`store.ts:192-208`, `internal/holdsSecret.ts:12`). The stored log never holds one, and the folded state holds none because state cannot.
- In a plain field, tried on a scratch copy against `packages/schema/src`: a `Secret` in `s.string()` or `s.json()` is refused with rule `type`. A `Secret` is not a string, and `isJson` refuses any prototype but `Object` (`packages/schema/src/internal/isJson.ts:8-10`). So `tx` returns `err(schema.invalid)`, and a transaction function returning one throws (`store.ts:140-141`). Log `meta` is `s.record(s.json())` (`internal/metaSchema.ts:4`), so a `Secret` in `meta` is refused as well.
- In `s.object({})`, an `s.record(...)` or an undeclared key, the parse succeeds and the encoding is `{}`: `isRecord` takes any non-null object (`internal/isRecord.ts:2-3`) and a `Secret` has no own keys. The value is lost, not stored.
- `String(secret)` and a template give the marker text `"[secret]"`, which a string field stores as text (`graft.ts:6`); the value is lost, not stored.
- A schema field that is `s.secret` refuses the marker on `restore` (`secret-missing`, `internal/check.ts:25`). So a store state holding a secret could never be restored from storage; E1303 makes that a construction error instead of a broken save.

**What happens to a revealed value.** `reveal(secret): T` returns the inner value (`packages/schema/src/reveal.ts:4-6`). It is a plain string or number from then on, so every sink keeps it as written:
- a `tx` payload field, then the log and the stored snapshot. The backlog 0257 repro is `tx(copy, { t: reveal(p.k) })` in a `*.server.ts` action: `c.snapshot()` holds the plaintext in `state` and `log`.
- `tx` options: `meta` is kept in `snapshot({ meta: true })`, the form a save writes; a write `key` is kept too.
- `store(schema, initial)` in a server factory: `initial` is stored.
- `ctx.storage.set` or `commit` from server code, `commitStores` (its `fn` calls `tx`), and std.jobs `enqueue` input: a plain field is stored, and E2503 only refuses `s.secret` in the input schema.
- the server log: an `Error` whose message holds it, or `console` output. k.server replaces `.pii` values in a `diag` record and does nothing for a revealed string.
- a loader or action response: returned as written.

**Sinks that cannot see a revealed value.**
- `#k-state` holds only request-scope stores (`packages/server/src/internal/snapshotStores.ts:9-12`); factory stores never enter it (k.server). Component code cannot `reveal` (E1105).
- Session capture is browser-only. `record` is a no-op on the server, and in the browser it drops `s.secret` fields and masks password inputs (std.sessions; `packages/std-sessions/src/internal/redactionOf.ts:29`).
- The inspector shows a `Secret` as the marker, and factory stores skip inspect.
- The evidence bundle holds no app value (k.evidence).

**What the existing rules catch.** E1105 reports `reveal` outside `*.server.ts` (`packages/check/src/rules/revealInServerFile.ts:13-41`). E1303 (b) reports `reveal` inside a `transaction(...)` function literal (`noSecretInState.ts:56-80`) and not a named or imported one (backlog 0258). ADR-0112 drops submitted `s.secret` and password-input values from a 422 re-render. E2503, E2602 and E2651 refuse `s.secret` in job inputs, channel messages and outbox bodies. None of these sees a revealed value passed to `tx` from a server action, which is the flow E1303's own fix text used to suggest (backlog 0257).

**What the repo does with secrets today.** No `s.secret` or `reveal` in `apps/` (golden-1, golden-2, inspector, sessions), `modules/`, `evals/tasks`, scaffold templates or any `packages/std-*/src`. `reveal` is called only in `packages/schema` tests and conformance and in `packages/check` fixtures. The std packages only refuse `s.secret` in schemas that are stored or sent.

**How far the check pipeline can follow a value.** `globalRefs(program)` (`packages/compiler/src/globals/globalRefs.ts:53-63`) binds each read to its declaration by lexical scope. `initOf` follows a same-file alias chain to its initializer (`ResolvedGlobals.ts`), and `sameBinding` tells an import from a shadowing local. E1603 already follows a value through `String()`, templates, `+`, `?:`, object literal properties and each value assigned to a local (`packages/check/src/rules/noCodeFromString.ts:71-81`; k.ctx Rules). No rule follows a value through a call's parameters or across files.

Tried on a scratch copy of `packages/check/src` with a draft rule of about 110 lines over `globalRefs`. These cases were each one finding: a direct `tx` payload, through a `const`, through destructuring, in a template, in `meta`, through a method (`.trim()`), through a closure inside `commitStores`, `ctx.storage.set`, `ctx.storage.commit`, `store(S, { t: reveal(K) })`, `console.log` and `new Error`. These were none: `hash(reveal(p.k))`, a compare, a value passed to a local helper, a `Secret` passed as is, and a shadowing local `reveal`.

## Proposal

### D1. A `Secret` is already kept out; state the limit once
No new runtime guard. The guards that exist are exact for `Secret` instances: E1303 at `store()`, the fold at `snapshot()`, and parse refusing a `Secret` in a plain or JSON field. A revealed value is a string like any other, and only the checker sees where it came from. k.privacy Secrets says what `reveal` returns is plain data, kept as written. k.store Secrets, k.persist Storage and std.db On disk point there. k.server is not touched.

### D2. E1112: a revealed value reaching a sink
`keel check` reports, in app code (`isAppPath`: not tests, not `unsafe/`), an argument of one of these calls that carries a value `reveal` returns:
- `tx` or `store`, named imports of `@keel/store` matched by binding, as E1303 matches them;
- `set` or `commit` called on a member or binding named `storage` (`ctx.storage.set`, `const { storage } = ctx`);
- a `console` method, resolved by `globalRefs`;
- a global whose name ends in `Error`, called or constructed.

`reveal` counts where it binds the `@keel/schema` import, or as `<namespace>.reveal`. A value carries one when it is the call, a binding any of whose values carries one (initializer or assignment, by lexical scope), a member of one, a spread, an object or array literal, a template or operator with one inside, `await`, `String()` or `JSON.stringify()` of one, or a method called on one. Any other call ends the flow. That is how a hash, an HMAC or a ciphertext passes, and also how `btoa(v)` passes (Known limits). A parameter ends it, and so does an import. Depth is capped at 16 links, as in E1603. One finding per sink call, at the argument, with data `{ sink }`. Message: "a revealed value reaches `<sink>`; store a value derived from it". No fix: what to derive is the author's choice.

### D3. Hashing guidance
k.privacy names the derived form: in server code, a salted `scrypt` hash (`node:crypto`), with the salt from `ctx.random.id` so a sim run replays, checked with `timingSafeEqual`. A credential the app must present later, such as an OAuth refresh token, cannot be hashed. Keel has no path for an app's own encryption key, so this RFC leaves that case to Questions 2.

### D4. Responses
A loader or action that returns a revealed value is not reported. Showing a new API token once is a real flow. ADR-0112 covers the accidental case, a re-render of a submitted secret.

## Alternatives
- (a) Allow `s.secret` in a store schema, with the marker as the stored form. Rejected: `restore` of the marker fails `secret-missing` (`check.ts:25`), so every request after the first save would fail to restore that store (`openStores.ts:49-50`). The value would also be gone after the first save, so the state would no longer be what the store holds. E1303 already refuses it at construction.
- (b) Only a same-expression check (`reveal(...)` as a direct sink argument). Rejected: one `const` defeats it. `globalRefs` already gives the binding walk for free (default 3).
- (b) Treat every call as carrying its arguments. Rejected: the documented hash would be reported, which leaves the author no clean form.
- (b) Report what the rule cannot read (a helper parameter, an import). Rejected: the common case is a helper that hashes, and an error with no fix and no escape on it would fire on correct code.
- (b) Widen E1303 to these sinks. Rejected: E1303 is about store state and lives in k.store, which has 10 tokens left. `storage`, `console` and `Error` are not store concerns.
- (c) A runtime registry of revealed values, checked at `commit` or `snapshot()`. Rejected: `reveal` in one request would decide whether an unrelated save fails, which is action at a distance (PRINCIPLES 2), and the outcome would depend on process history (PRINCIPLES 10). A user who types the same short string as someone's revealed PIN would be refused. The process would hold every revealed value for longer, and a slice or a concatenation still passes. RFC 0073 rejected the same gate inside `tx`.
- (c) A guard in `commit` or in std.db refusing a `Secret`. Rejected: `set` and `commit` take strings by type, and a `Secret` that reaches `JSON.stringify` writes the marker, so there is nothing to refuse.
- (d) A `hashSecret`/`verifySecret` pair in this RFC. Rejected for now: a new user-facing API shape is the user's to approve (Questions 1).
- Responses as a sink. Rejected (D4).

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/` at `c7d48ec`. No sentence a conformance header quotes changes.

### k.privacy (1,190 to 1,464)
**Secrets**, appended after "`gen` wraps a generated inner value; `doc()` is `secret<T>`.":

> What `reveal` returns is plain data: a store, a storage driver or a log keeps it as written, and nothing at run time tells it from another value. A credential is kept as a value derived from it in server code: a salted hash to check it (`node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual`).

**Rules**, appended after "(`tableSearch` from `@keel/std-tables`).":

> E1112 a value `reveal` returns reaching an argument of `tx` or `store` (`@keel/store`), `set` or `commit` on a `storage`, a `console` method or an `Error` constructor, in app code (no fix). It is followed by lexical scope through same-file bindings (each value given), members, spreads, literals, templates, operators, `await`, `String()`, `JSON.stringify()` and methods called on it; any other call, a parameter and an import end it (a hash passes; a helper is not read).

**Conformance**, appended:

> - In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none.

### k.store (1,490 to 1,500)
**Secrets**, appended:

> A revealed value is plain data (k.privacy).

**Ids and invariants**, the sentence "Log entry `at` comes from `clock` (default: a counter); never from `Date`.", replacement text:

> Log entry `at` comes from `clock` (default: a counter), never `Date`.

### k.persist (1,187 to 1,195)
**Storage**, the first sentence, replacement text:

> **Storage.** `ctx.storage` holds string values by string key, as given (secrets: k.privacy); each operation returns a promise:

### std.db (988 to 983)
**On disk**, the sentence "A value `reveal`ed into a plain field is plain data: it is stored as written, and std.db cannot tell it apart.", replacement text:

> A value `reveal`ed into a plain field is plain data, stored as written (k.privacy, E1112).

### Unchanged
k.server (1,497), k.check, k.compiler, k.schema, std.sessions, std.jobs. `spec/00-map.md` already maps E110x to k.schema and k.privacy. k.check needs no sentence, since E1112's text lives in k.privacy.

## Conformance diff
Written by the `conformance-writer` from the sentences above. This RFC allows these changes under `packages/*/conformance/**`.

New file:
- `packages/check/conformance/privacy-e1112.test.ts`, with these headers:
  - `// Spec: k.privacy, Rules "E1112 a value `reveal` returns reaching an argument of `tx` or `store` (`@keel/store`), `set` or `commit` on a `storage`, a `console` method or an `Error` constructor, in app code (no fix)."`
  - `// Spec: k.privacy, Rules "It is followed by lexical scope through same-file bindings (each value given), members, spreads, literals, templates, operators, `await`, `String()`, `JSON.stringify()` and methods called on it; any other call, a parameter and an import end it (a hash passes; a helper is not read)."`
  - `// Spec: k.privacy, Conformance "In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none."`

  Cases: the clause's list, plus a property (seed 1337) that wraps `reveal(p.k)` in 1 to 4 generated carriers (`const`, a member, a template, `+`, an object or array literal, a spread, `?:`, `await`, `.trim()`, `String()`) and expects one finding with no fix. The same wrappers under one call of a local function expect none. Further cases: `storage.commit`, `store(S, { t: reveal(K) })`, `<namespace>.reveal`, a `const { storage } = ctx` binding, a file under `unsafe/` and a test file (none), and `modules/app/c.server.ts` with backlog 0257's `copy` action (one).

Changed files:
- `packages/check/conformance/fixtures-by-code.ts`: an `E1112` entry after `E1111`. The bad fixture is `modules/app/x.server.ts` doing `tx(copy, { t: reveal(p.k) })`. The clean fixture is the same with `hash(reveal(p.k))` and a local `hash`.
- `packages/check/conformance/fix-diffs.test.ts:302`: `NO_FIX` gains `"E1112"` ("what to derive is the author's choice").

Existing tests that go red between the spec commit and the check lane: `packages/check/conformance/explain-and-fixture-per-code.test.ts` and `explain.test.ts`. Both read every Rules code from `spec/kernel/*.md` (`spec-codes.ts`), and E1112 has no explain row or fixture until lane 3. No other suite breaks. The E1303, E1105 and store secret suites filter by their own code or run on test paths, which E1112 skips.

## Lanes and build order
1. Orchestrator: the spec text above, one commit. It lands before the S8 db lane's conformance-writer runs, since std.db On disk now cites E1112 and k.privacy. This is the part that must land before `@keel/std-db` is built.
2. `conformance-writer`: the conformance diff, in the `rfc:0100` PR.
3. Check lane, one agent, `packages/check` only: `rules/revealedValue.ts` over `globalRefs` and E1603's value walk, `KERNEL_RULES`, the `EXPLANATIONS` row (under 120 tokens), `test/revealedValue.test.ts`, the README Compliance line, and the budget re-base. Its paths are disjoint from S8's kernel lane (`packages/ctx`, `packages/store/src/internal`, `packages/server`) and from the db lane, so it runs in parallel with them. It merges before golden-1 moves to std-db and before the S8 exit proof. Nothing in `@keel/std-db` depends on it.
4. Orchestrator: the threat-model lines below, the `keel-compliance` skill line (E1112, the hash form), backlog 0257 closed, Questions 1 to 4 filed as backlog lines, and the ledger on a quiet tree.

## Migration
- Apps and std packages: nothing fires. No `reveal` exists outside `packages/schema` and `packages/check` tests.
- Scaffold templates and evals: unchanged.
- Docs: `packages/check/README.md` (Compliance rules gains E1112) and `.claude/skills/keel-compliance/SKILL.md` (Secrets line).
- An app outside the repo that writes a revealed value into a payload, state, storage or a log gets E1112 at each argument. It moves to passing the `Secret` (a payload `s.secret` field folds out of the snapshot) or to storing a derived value.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.privacy | 1,190 | 1,464 |
| k.store | 1,490 | 1,500 |
| k.persist | 1,187 | 1,195 |
| std.db | 988 | 983 |

`keel explain E1112` is one row under 120 tokens.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild, minified ESM, packages external, gzip) on the scratch prototype.

| Entry | Limit | Before | After |
| --- | --- | --- | --- |
| `@keel/check` | 48.25kb (49,408) | 49,198 | 50,063: re-base to 49.25kb (50,432) |
| `@keel/store` | 3.5kb (3,584) | 3,086 | unchanged |
| `@keel/schema` | 5.5kb (5,632) | 5,272 | unchanged |
| `@keel/compiler` | 30.5kb (31,232) | 31,031 | unchanged |

The 865 B pay for the rule and its explain row, which k.check Conformance requires of every reported code. S8's own check rules (E1563, W1564, E1572 to E1575) grow the same bundle. The orchestrator adds this RFC's 865 B to whatever limit S8 prep sets, and does not replace that limit.

## Threat model
Text for `docs/THREAT-MODEL.md`. Under **Kernel commitments**, the **Secrets** bullet, replacement text:

> - **Secrets.** `s.secret` values (`Secret<T>`) serialize and log only as `"[secret]"`, never restore from JSON, and are read only by `reveal` in `*.server.ts`. E1105 (`packages/check/src/rules/revealInServerFile.ts`) reports `reveal` anywhere else in app code (RFC 0026). No `Secret` reaches storage or a database. Store state refuses one (`store()` throws E1303), a snapshot folds every log entry up to the last secret payload, a plain or JSON field refuses one, and job inputs, channel messages and outbox bodies refuse one (E2503, E2602, E2651). What `reveal` returns is plain data, and nothing at run time tells it from another string. E1112 reports a revealed value reaching `tx`, `store`, a `storage` write, `console` or an `Error` in the same file (RFC 0100). These are not detected: a value carried through a helper's parameter, an import or an encoding call (`btoa`, `Buffer.from`), std.jobs' `enqueue`, a response, and a credential the app parses as `s.string`, which is plain data from the start. The rules stop accidents. An author who means to store a secret can always do so, and the documented form is a salted hash (k.privacy).

In the **Sessions** bullet, the sentence "A revealed value copied into a plain payload or state field is not detected." becomes:

> A revealed value is plain data; the Secrets commitment says what E1112 catches.

## Risks
- E1112 fires on `tx(login, { k: reveal(p.k) })` even when `k` is an `s.secret` field, where the payload would wrap it again and fold it out. The rule does not read the payload schema. The message tells the author to pass the `Secret`, which is the better form anyway.
- A local reassigned from a revealed value to a hash (`let t = reveal(x); t = hash(t)`) is still reported, since each value given to a local counts, as in E1603. The clean form is one `const`.
- A member of a carrying object carries (`o.length`, `o.other`), so a non-secret field read off an object that holds a revealed one is reported.
- `set` and `commit` match on the receiver name `storage`, so an app object named `storage` with those methods is a sink too.
- k.store is at 1,500 tokens and has no room; its next addition needs a trim.
- `@keel/check` sits 369 B under its new limit before S8's rules.

## Known limits
- Not followed: a function parameter (a helper that stores), an import, a value passed through a call that is not `String()`, `JSON.stringify()` or a method on it. That covers encodings such as `btoa`, `Buffer.from` and `encodeURIComponent`. Also not followed: a computed member write (`o[k] = v` read later), a class field, and a closure that captures a `let` assigned in another function. All of these pass.
- std package sinks that store input are not sinks of E1112: std.jobs `enqueue`, and a workflow event passed to std.workflows. The kernel rule names no stdlib call; ADR-0122 D3 keeps the checker's stdlib names to one audited export. Questions 3.
- A password from a form over `s.string`, the common case ADR-0112 names, is plain data from the start, and no rule follows it. Questions 4.
- A `Secret` in `s.object({})`, an `s.record(...)` or an undeclared key encodes as `{}`: the value is lost without an error. Nothing is stored, so this is a correctness gap, not a leak. Recommendation: a k.schema backlog line, "a `Secret` where the node is not `secret` fails rule `type`".
- E1303 (b) still misses named and imported reducers (backlog 0258) and still fires on a reducer that only compares (backlog 0262). E1112 does not change it.

## Questions
1. A hash and verify helper. Recommendation: a backlog line for a std package (`@keel/std-credentials`, a name for the user to confirm) with `hash(ctx, secret)` and `verify(secret, stored)`. Both take a `Secret`, so no `reveal` is needed to store a credential, and `scrypt` parameters are fixed and versioned in the stored string. It is a new user-facing API shape, so the user approves it. Until then k.privacy names the `node:crypto` form.
2. A credential the app must present later (an OAuth refresh token, a third-party API key a user pastes in). It cannot be hashed. Storing it needs an app encryption key, and Keel has no path for an app secret from the environment: `KEEL_SECRET` is the caller-cookie key, and "secrets come through `ctx`" names no accessor. Recommendation: a `tasks/FUTURE.md` line for an envelope-encryption helper over a key read from the environment, built when an app needs it. Today such a value is written from a file under `unsafe/`, which E1112 skips and the `unsafe` count records. k.privacy should not say so until the user confirms it, since it names an escape (escalation: anything that weakens privacy).
3. Revealed values into std.jobs `enqueue`. Recommendation: a backlog line for std-jobs' `./tools` to report it. That needs E1112's value walk exported to tools (`@keel/check` tools entry), which is a tools API decision of its own.
4. A password input bound to an `s.string` field. Recommendation: a backlog line for a k.forms warning when a `type="password"` or `autocomplete` `*-password` control binds a field that is not `s.secret` (fix: wrap it in `s.secret`). Then the secret mark follows the value from the form to `reveal`, where E1112 sees it.
