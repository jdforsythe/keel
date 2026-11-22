# ADR-0217: two factories of one route chain that create one store id are E1550 (RFC 0195)

**Status:** accepted (orchestrator; a plain consequence of k.store Registries and k.server Server state, for the operator to confirm).

**Context.** A request holds one live store per id (k.store Registries), and each factory a request's loaders name opens once (k.server Server state). A layout's loader and its page's loader naming two factories that both create one id therefore throw on every request, and the second loader's 500 is the first sign; `keel check` passes the app.

**Decision.** E1550: `keel check` reports two factories named by the loaders of one route chain that create one store id, at the deeper loader's `stores` value, reading factories statically as E1558 reads loaders; `keel build` and `createApp` run each factory once on a sim ctx, as the surface run does, and refuse what the static read could not. Loaders of one chain share a store by naming one factory.

**Alternatives.** The second factory gets the existing store (`store()` would return a live instance and transactions would be declared twice on one store: a second way to share); two instances per id read at one cut (two live stores for one id, a save choosing between snapshots); `stores: [a, b]` (changes what an author writes; a later RFC if needed); documentation only (the failure stays a 500).

**Consequences.** What an author may write does not change; the failure moves from every request to `keel check`, `keel build` and `createApp`. `@keel/check` gains a rule that follows factories across calls and imports; `createApp` runs factories once at start. The run-time throw in `openHeld` stays as the backstop.
