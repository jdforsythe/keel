# ADR-0142: reveal notes the value it opens into the current scrub scope (RFC 0110)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** A `Secret` joined a request's or runner `run`'s scrub set only when made there. One made at module scope, in `createApp`'s config, or in an earlier request and kept by a module, then revealed and thrown in a later request, was logged in clear.

**Decision.**
- `reveal` calls the listener slot `Secret.of` calls, with the `Secret`, before it opens it. `Secret.open` does not, so the server's own walk and `check` never reach the listener.
- The server's listener walks a `Secret` into the running scope's set once per scope, keeping a `WeakMap<Set<string>, WeakSet<Secret>>`; a repeat is one `WeakSet.has`. Outside every scope it does nothing.
- The caps bound a set as before: a revealed secret can put a set past its cap.

**Alternatives.**
- Hook `Secret.open`: the server's walk and `check` would call the listener.
- One process-wide set of startup secrets: no scope bounds it, and every request would scrub every startup value.
- Hand the listener the raw value: no raw value leaves `Secret.ts` through the slot.

**Consequences.**
- Startup, module and cached secrets revealed in a request, live stream or runner `run` log as `[secret]`.
- The listener contract reads "made or revealed"; listeners other than the server's hear each `reveal`.
- Limits that stay: a value revealed outside every scope or in an earlier one and kept as plain text; a secret revealed in an in-process request a runner starts; a path the server forwards to a peer.
