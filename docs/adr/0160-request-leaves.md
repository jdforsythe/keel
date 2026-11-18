# ADR-0160: what a request leaves (RFC 0138)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** `#k-state` carries a snapshot of every request store, islands or not, so a loader's store of another person's contact data reaches the browser. The pre-resume queue never prevents a default, so a `submit` fired before resume posts natively and then replays to the island's handler. The E1256 mark follows a request's timers after its response, and no Keel server handles an uncaught exception, so any late throw ends the process by Node's default. A refused snapshot's E1253 warning is built but not specified.

**Decision.**
- C1: `#k-state` `stores` holds a request store only when an island level's server render created, looked up or read it; a document with no island has `stores` `{}`.
- C2: a needed snapshot ships its `.pii()` values; E1107 reports a `store` in client-reachable code whose schema holds a class the module's `clientPii` does not list (fix adds it). `s.secret` never ships (E1303, the secret fold).
- C3: a queued `submit` is prevented at capture and, if no handler prevented it at replay, submitted natively once with its submitter and no second event; a non-fragment link click is not queued; other defaults happen when the event fires.
- C4: the request mark stays on work the request starts, for its whole life; `tx`, `restore`, `undo` and `undoWhere` are guarded; the async-context limit is stated.
- C5: `server.mjs` and `keel dev` handle uncaught exceptions and rejections with one E1577 record (route id when known, no thrown text in production); production drains in-flight requests for at most 10 s and exits 1; dev keeps serving; `createApp` installs no process listener.
- The contract lives in new sections k.leave and k.defaults; k.server and k.resume prose changes with the build.

**Alternatives.** Ship only stores an island render creates (breaks the loader-seeds, island-reads pattern). Redact marked values in `#k-state` (the island renders `[pii]`). `requestSubmit` at replay (a second `submit` the resumed island handles again). Prevent link clicks until resume (holds working links). End the request mark at the response (late writes leak request data unchecked). Keep Node's default, or log and keep running (no record, or a process in unknown state). Listeners in `createApp` (a library owning its host's process).

**Consequences.**
- Documents carry less: loader-only stores and island-free pages ship no store state.
- A module that keeps personal data in client-side stores declares the classes; `keel check` enforces it.
- A deployment needs a supervisor that restarts on exit 1 (Docker restart policy, systemd, a platform); the deploy skill says so.
- An island page's early submit waits for resume, then goes once.
