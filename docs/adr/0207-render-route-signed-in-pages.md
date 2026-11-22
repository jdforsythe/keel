# ADR-0207: k.user Testing: a `renderRoute` page is signed in for its own requests, one browser per harness (RFC 0185)

**Status:** accepted (orchestrator, under the RFC defaults; for the operator to confirm).

**Context.** `renderRoute`'s `user` reaches guards, loaders and actions only. A component's own service call on the `createApp` ctx is answered in process with no identity, so a signed-in page whose components call a guarded API gets 403 under test and passes in a browser. One ctx has one service binding, so two signed-in users on one app cannot be expressed.

**Decision.** `user` covers every request the page makes, carried as `x-keel-user` signed by the `createApp` binding on `ctx`, so no `identify` runs. In router mode a contract call that names no `user` carries the harness's `user`, and a second user on one ctx is E1724. With `app` each harness is a browser: the page runs on its own ctx (the test ctx's clock and random, its own storage and caller), and its same-origin requests go through `ctx.net` to `app.fetch`. Two harnesses over one `app` are two users of one server state. A `user` with `app` on a ctx that holds no binding of `app` is E1724.

**Alternatives.** A derived ctx per page in router mode (ctx-keyed registries split from the API); signing in through the identity mount (slow, and happy-dom drops `set-cookie`); an ambient current page during `fire` (lost after an `await`); a `headers` option (a second way to say who the page is); a `ServerApp` method that answers as a user (production surface for a test need).

**Consequences.** Signed-in pages are testable through their components, and layer 7's two-member live test is two `renderRoute` calls. k.user reads `implemented` until three new clauses are covered. New code E1724. RFC 0180's document mode resumes the page in its own browser ctx.
