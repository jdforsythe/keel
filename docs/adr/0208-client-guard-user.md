# ADR-0208: k.guards Client: a guard in a `client` deployable or a shell learns the reader from one read per session (RFC 0186)

**Status:** accepted (orchestrator, under the RFC defaults; for the operator to confirm, see RFC 0186 For the operator).

**Context.** On a `client` deployable and in a shell a guard's `user` is always `''`, so an app guarding a page by sign-in calls its own API on every guarded navigation. The session cookie is `HttpOnly` in a browser and in the native store in a shell; only `identify` on the `node` deployable that mounts `handle` can say who the reader is.

**Decision.** A `node` deployable with an identity source answers `GET /__keel/user` (with `x-keel: 1`, `no-store`) with `identify`'s answer. A `client` router whose modules import `identity.ts` reads it once before its first guard and again after each mount answer in a shell, and gives that `user` to guards, loaders and actions (`''` before an answer or on a failure). It is held in memory only and is navigation convenience, never authority: every API keeps its own guards. Under `renderRoute`, `user` stands for the answer.

**Alternatives.** Status quo with a documented pattern (a call per navigation, or a cache each author invalidates); a signed non-secret user hint (the client cannot verify it, a Keel cookie breaks k.mount, a shell cannot read its native store, `index.html` is bundled); an app-named contract method (app code and an option for what `identify` answers); a read before every navigation (the cost itself); a persisted client session (a user id in storage, honoured by nothing).

**Consequences.** The guard a `node` page uses works on a client page and in a shell. One more kernel entry and one `identify` call per document or mount answer. Apps whose `identify` reads a per-call bearer keep calling their API. k.guards reads `implemented` until clauses 4 to 7 are covered.
