# ADR-0161: sign-in outlives the caller (RFC 0139)

**Status:** proposed (RFC 0139, for the orchestrator to accept). Supersedes the choice RFC 0132 posed for the caller cookie ("session" or "persistent").

**Context.** The caller cookie is a session-only anonymous token and not a credential. golden-2 ties being signed in to it, so a browser quit or any shell relaunch signs the user out and outbox writes queued under the user are refused. `@keel/std-credentials` has hashes and tokens but no sign-in. Persisting the caller for everyone would make every browser carry a 400-day identifier and still not authenticate anyone.

**Decision.**
- C1: the caller stays session-only and grants nothing; undo and stream caps stay per caller.
- C2: `@keel/std-credentials` keeps a durable sign-in in its own `HttpOnly; SameSite=Lax` cookie (`__Host-keel-signin` on https); guards, loaders and actions get `user` beside `caller`; actions get `signin` (`start`, `end`, `endAll`); the kernel carries the cookie through `createApp({ signin })`, which the generated entries fill.
- C3: rows hold the token's digest, compared in constant time; `days`, `idleDays` and `perUser` are the app's std config; the secret rotates every 24 h with a 60 s overlap, and a rotated-out token presented later ends the sign-in; `start` never adopts a presented value.
- C4: shells keep the sign-in in a native secure slot (Android Keystore, iOS Keychain this-device-only, the OS keyring through a Tauri Rust plugin), never in the cookie store or `storage`, never readable by the page.
- C5: outbox owner is `user`; channel `member` and std.sessions `readers` see `user` and `caller`.
- C6: a `node` deployable may set `caller: { days }` (1 to 400, E1578): the caller hash is then classed `.pii('network')` and recorded in `pii.json`.

**Alternatives.** A persistent caller for all (an identifier everywhere, still not authentication). A kernel-only sign-in (the operator placed it in the package). App-written session stores (each app re-implements rotation and revocation). A signed stateless cookie (no revocation). `user` in `ctx` (per-request identity in the capability object). Cookie store, `storage` driver or a page-held header in shells (clear-text files, or readable by injected script).

**Consequences.**
- Signing in survives browser and app restarts; signing out everywhere is one call.
- golden-2 drops its sessions store and calls `signin.start`; apps that want continuity without accounts opt in per deployable and the evidence bundle shows it.
- Shell packages gain native work, Tauri a Rust plugin; CI proves them against doubles until a device run.
