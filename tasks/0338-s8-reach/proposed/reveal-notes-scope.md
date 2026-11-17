# Proposal: `reveal` notes the value it opens into the current scrub scope

**Problem.** A `Secret` joins a request's or runner's scrub set only when it is made there (`Secret.of` calls the listener). One made in an earlier request and kept by a module (`cached ??= parse(...)`), or made at module scope or in `createApp`'s config, then revealed and thrown in a later request, is logged in clear (`loader api.l threw: Error: upstream refused key tok-...`).

**Where.** `reveal` is `packages/schema/src/reveal.ts`: `return Secret.open(secret)`. The one listener slot is `internal/listening.ts`, written only by `onSecret` and called by `Secret.of` with the new `Secret`. Change: `reveal` calls the same slot before it opens, `listening.current?.(secret)`. `@keel/schema` still knows nothing of the server: the server's listener (`noteRequestSecrets`) already takes a `Secret`, walks it (`secretWalk`) into the set of the running scope (`requestSecrets.getStore()`), and does nothing outside every scope. The listener contract is unchanged: it gets a `Secret`, never a raw value. The hook goes in `reveal`, not `Secret.open`, so `secretWalk` and `check`, which open secrets through `Secret.open`, never call the listener.

**Cost per `reveal`.** In no scope: one slot read and one `AsyncLocalStorage.getStore()`. In a scope: the first `reveal` of a `Secret` walks it as `Secret.of` does today (one value for a string secret, a `Set.has` and its written forms through `holdSecrets`); the server keeps a `WeakMap<Set<string>, WeakSet<Secret>>`, so each later `reveal` of the same `Secret` in the same scope is one `WeakSet.has`. A revealed value already in the set adds nothing, and the caps (`SCRUB_CAP`, `SECRETS_CAP`) bound the set as today. No allocation on the hot path once noted.

**What it covers.** A secret made at startup, at module scope, in `createApp`'s config, or in an earlier request, revealed inside a request, a live stream or a runner's `run`: its values join that scope's set, so its `diag` records and `req` path hold `[secret]`. The threat model's startup limit narrows to "revealed outside every scope".

**What stays a limit.**
- A value revealed in an earlier request or at startup and copied into a plain variable (`key = reveal(s)` kept by a module), then thrown later without a new `reveal`: no scope hears of it.
- A secret revealed in an in-process request a runner starts (`service({ module })`) joins that request's set, not the runner's.
- A front server forwarding to a peer logs the path as it came.
- A revealed value is plain data; E1112 remains the static guard.

**Spec diff (`spec/kernel/k.privacy.md`, Sinks, Server log).** Section today 5,996 characters; after 5,998 (budget 6,000).
- "in a `Secret` made while the request runs (`bearer` too)" becomes "in a `Secret` made or revealed while the request runs (`bearer` too)".
- "A runner's `run` is scoped alike; startup is not. An action's `output` is a loader's." becomes "A runner's `run` is scoped alike." (startup is no longer a blanket exception; the threat model keeps the limit above).
- "its loaders' outputs and its factories'" becomes "its loaders' and actions' outputs and its factories'" (carries the dropped sentence).
- "`[secret]` if the scope made a secret." becomes "`[secret]` if it holds a secret."
- Conformance: "as does a loader or action throwing one parsed after an `await`," becomes "as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it,".

**Conformance to add (`packages/server/conformance/privacy-secret-reach.test.ts`, by the conformance writer).**
- A loader that throws the revealed value of a `Secret` made in an earlier request and kept by the module logs `[secret]`, in dev and production, compact and json.
- A loader or action that reveals a module-scope `Secret` and throws it logs `[secret]`; a runner's `run` that does so logs `[secret]` in its `runner rejected` record.
- Of two overlapping requests that reveal the same module `Secret`, each marks it; one that never reveals it does not hold it in its set.
- A value revealed in an earlier request, kept as a plain string and thrown later without a `reveal`, logs as is (the stated limit).

**Also.** `THREAT-MODEL.md` Secrets limits: replace "a secret made at process startup, at module scope or in `createApp`'s config, is in no scope" with "a value revealed outside every scope and kept as plain text"; changeset for `@keel/schema` and `@keel/server`.
