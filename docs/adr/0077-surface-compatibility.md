# ADR-0077: surface compatibility is checked from `surface.json` (RFC 0080)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 3 and 6.

**Context.** Once deployables ship at different times, a producer's change can break a caller still running older code, and within one commit a caller's hand-written endpoint can disagree with the route it calls. No artifact records the surface a caller was built against, and check rules are pure, with no access to git.

**Decision.** `keel build` writes `.keel/surface.json`, a k.compiler artifact: every route's path, params, search, GET answer and action input and answer, and every `service({ module })` endpoint with its calling module, all as JSON Schema; the build evaluates `routes.ts` and each `endpoints` file a `service({ module })` names. `accepts(A, B)` holds when every value `B` admits parses with `A`, decided on schema kinds. E1561 reports an endpoint its route does not accept, or whose `output` refuses the route's answer, in every topology. With `keel check --base <surface.json>`, E1562 reports a route change that a base endpoint in another deployable refuses, with a fix when the change is one added required object field. The generated CI passes the base branch's surface. Both rules live in a new section, k.compat.

**Alternatives.**
- Equal schemas, rejected: every additive change would fail.
- Reading git history inside the rule, rejected: rules are pure.
- A fix for E1561, rejected: choosing between a caller's and a producer's intent is a judgment; the message names the producer's schema.

**Consequences.**
- The same change can be clean in one topology and E1562 in another, since callers deployed with their producer ship together.
- A new caller against an old producer is a deploy-order rule (producers first) the CI does not enforce.
- `@keel/check` grows by about 1.3 kB and its budget is re-based.
