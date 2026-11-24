# ADR-0237: std.sessions: a session of a served page replays through its app (RFC 0215)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** `keel session to-test` writes `renderRoute(<id>, { routes, state, ... })` through a router for every page, and W1723 (k.testing) warns on that for a page a `node` deployable serves. `replay`, which `to-test` runs to prove a reproduction before writing a file, is defined for router mode only. A recording keeps no user and no server state, and `renderRoute` with `app` rejects `state` (E1722).

**Decision.**
- `replay` and `minimize` take `serve(ctx)`, resolving a `createApp` result made on the replay ctx, as std.multi's `serve` does. With it the base renders with `renderRoute` and `app`; guards, loaders and actions run in the app over a sim storage that starts empty, and the recorded `state` is not applied.
- `keel session replay|minimize|to-test` replay with `serve` when the deployable serving `route.id` is `node`, building the app as the generated entry does (`topology`, `deployable`, every placed module's routes, the identity source; no runners, peers, assets or `std` config), and through the router otherwise.
- The recording gains no user. `--user <id>` on the three commands, and `user` on `replay` and `minimize`, sign the base in through k.user Testing in either mode; the emitted test writes `user` only when `--user` was given.
- A base that resumes as another route is E2003 for the base, `unapplied` `-1`, `base route <id> redirected to <other id>`.
- The `node` form of the `to-test` file builds the same app in the test body and passes `app`, with no `state`. W1723 is unchanged: a hand-written router-mode test of a node page keeps it.

**Alternatives.**
- Changing only the emitted test: `to-test` would prove in one mode and write a test in another.
- Replaying recorded net exchanges or seeding storage from the recorded `state`: the first puts loader answers, personal data among them, into every session; the second invents server state from a browser's stores.
- Recording a user or a signed-in flag, or a fixed placeholder user: the browser of a node page does not know its user, the id is an identifier the recording keeps out, and a placeholder breaks pages that redirect a signed-in person.

**Consequences.** `apps/sessions`' two emitted files are written again in the `app` form. Its four hand-written cases and golden-2's one pass `app` by hand. A session whose error depends on production server state, a runner or a peer does not reproduce and gets no file. The nightly Action passes no `--user`, so a guarded node page's session reports E2003 there. std.sessions reads `implemented` until its four new clauses are covered.
