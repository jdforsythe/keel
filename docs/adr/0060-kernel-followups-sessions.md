# ADR-0060: resume reports the route, `observe` is a capability, `@keel/router/match`, secret payloads (RFC 0071)

**Status:** accepted (2026-11-09). These follow from ADR-0059 (RFC 0070, accepted by the user) and amend its decisions.

**Context.** The red-team pass on RFC 0070 and backlog 0092 found four gaps:
- `record` on a server-rendered deployable got no `nav` and missed inputs made before resume (0212).
- `observe` was ambient (0216).
- std-sessions depended on `@keel/router/internal` (0218).
- A `tx` payload could not hold an `s.secret` field (0205).

**Decision.**
- **Resume (k.runtime, k.ctx).** The server writes `route: { id, path, href, params, search }` (encoded) into `#k-state`. `resume` reports it as the ctx's first `nav` (`schemas` `{}`) before any island. Per island, it then dispatches a real `input` on each value control off its default with none queued, and replays queued events through the observer tap before their handlers.
- **`observe` (k.ctx, k.module).** `observe` is a declared capability. E1156 reports an `observe` import from `@keel/ctx` (any alias, or `<namespace>.observe`) in a module whose `capabilities` lack it, and its fix adds it. There is no runtime gate, because a ctx carries no module identity.
- **`@keel/router/match` (k.router).** `matchHref(routes, href) -> { id, params, search } | null` is public and versioned, with its own size budget. `routes.href` is its inverse.
- **Secrets (k.store).** `copy()` keeps each `Secret` (it is frozen) inside the codec copy. `snapshot()` folds every entry up to the last secret-holding one into `initial`, so no secret is written.

**Alternatives.**
- Browser-side route matching, rejected because it ships loaders.
- Reporting typed values without dispatching them, rejected because replay would diverge.
- A stdlib-only `observe`, rejected because there is no caller identity to check.
- Listing std-sessions as an internal consumer.
- `structuredClone`, rejected because it loses a `Secret`.
- Non-replayable snapshot entries.
- A check rule forbidding secret payloads.

**Consequences.**
- std-sessions declares `observe` and imports `@keel/router/match`.
- A resumed page's base route has encoded params and no schemas.
- Undo cannot reach entries folded for a secret after a restore.
