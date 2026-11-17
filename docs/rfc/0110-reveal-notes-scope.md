# RFC 0110: reveal notes the value it opens into the current scrub scope

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). ADR-0142 records it. The design is the accepted proposal `tasks/0338-s8-reach/proposed/reveal-notes-scope.md`.

## Problem
A `Secret` joins a request's or a runner `run`'s scrub set only when it is made there: `Secret.of` calls the one listener slot (`packages/schema/src/internal/listening.ts`), and the server's listener (`noteRequestSecrets`) walks the new `Secret` into the set of the running scope. A `Secret` made earlier and revealed later is in no set:
- made in an earlier request and kept by a module (`cached ??= parse(...)`);
- made at module scope, or in `createApp`'s config, before any scope exists.

Revealed and thrown in a later request, its value is logged in clear: `loader api.l threw: Error: upstream refused key tok-...`. THREAT-MODEL states the whole startup case as a limit.

## Proposal
`reveal` (`packages/schema/src/reveal.ts`) calls the same listener slot `Secret.of` calls, before it opens: `listening.current?.(secret)`, then `Secret.open(secret)`. `@keel/schema` still knows nothing of the server, and the listener contract is unchanged: it gets a `Secret`, never a raw value. The hook goes in `reveal`, not `Secret.open`, so `secretWalk` and `check`, which open secrets through `Secret.open`, never call the listener.

The server's listener notes a `Secret` once per scope. `packages/server/src/internal/notedSecrets.ts` keeps a `WeakMap<Set<string>, WeakSet<Secret<unknown>>>`: the secrets already walked into each set. The listener reads the running scope's set (`requestSecrets.getStore()`); outside every scope it returns. Inside, a `Secret` already in the set's `WeakSet` costs one `WeakSet.has`; a new one is walked (`secretWalk`) into the set through `holdSecrets` as today, and added to the `WeakSet`. A `Secret` made in the scope is noted when made, so a later `reveal` of it in that scope is one `has`.

**Cost per `reveal`.** In no scope: one slot read and one `AsyncLocalStorage.getStore()`, no allocation. In a scope: the first `reveal` of a `Secret` walks it as `Secret.of` does; each later one is a `WeakMap.get` and a `WeakSet.has`. A revealed value already in the set adds nothing, and the caps (`SCRUB_CAP`, `SECRETS_CAP`) bound the set as today: a revealed secret that takes a set past a cap puts it past, and a set past its cap takes no more values.

**What it covers.** A secret made at startup, at module scope, in `createApp`'s config, or in an earlier request, revealed inside a request, a live stream or a runner's `run`: its values join that scope's set, so its `diag` records and `req` path hold `[secret]`. Overlapping requests each hold only what they made or revealed themselves (`AsyncLocalStorage`).

**Stated limits.**
- A value revealed outside every scope, or in an earlier scope, and kept as a plain string (`key = reveal(s)` kept by a module), then thrown later without a new `reveal`: no scope hears of it.
- A secret revealed in an in-process request a runner starts (`service({ module })`) joins that request's set, not the runner's.
- A front server forwarding to a peer logs the path as it came.
- A revealed value is plain data; E1112 remains the static guard.

## Alternatives
- Hook `Secret.open`: `secretWalk` and `check` open secrets through it, so the listener would hear the server's own reads, and a walk would re-enter itself.
- Mark every `Secret` at startup into a process-wide set: every request's log would scrub every startup value, and the set would grow without a scope to bound it.
- Pass the raw value to the listener: the contract is that no raw value leaves `Secret.ts` through the slot.
- No per-scope memo: a loader that reveals a module secret per yield of a live stream would walk it each time.

## Spec diff
`spec/kernel/k.privacy.md`, Sinks, Server log:
- "in a `Secret` made while the request runs (`bearer` too)" becomes "in a `Secret` made or revealed while the request runs (`bearer` too)".
- "A runner's `run` is scoped alike; startup is not. An action's `output` is a loader's." becomes "A runner's `run` is scoped alike."
- "its loaders' outputs and its factories'" becomes "its loaders' and actions' outputs and its factories'" (carries the dropped sentence).
- "`[secret]` if the scope made a secret." becomes "`[secret]` if it holds a secret."

Conformance:
- "as does a loader or action throwing one parsed after an `await`," becomes "as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it,".

The Conformance bullets keep their order.

## Conformance diff
Written by the `conformance-writer` from the spec text above, in one `rfc:0110` commit before the build.

**`packages/server/conformance/privacy-secret-reach.test.ts`** (added cases):
- A loader that throws the revealed value of a `Secret` made in an earlier request and kept by the module logs `[secret]`, in dev and production, compact and json.
- A loader or action that reveals a module-scope `Secret` and throws it logs `[secret]`; a runner's `run` that does so logs `[secret]` in its `runner rejected` record.
- Of two overlapping requests that reveal the same module `Secret`, each marks it; one that never reveals it does not hold it in its set.
- A value revealed in an earlier request, kept as a plain string and thrown later without a `reveal`, logs as is (the stated limit).

Existing cases whose header quotes a changed sentence get the new quote; no assertion changes.

## Migration
None. Log readers see `[secret]` where a revealed startup or module secret stood in a request's or runner's records.

## Token impact
k.privacy 5,996 to 5,998 characters, 1,499 to 1,500 tokens of 1,500. No other section changes.
