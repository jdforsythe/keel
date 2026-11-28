# ADR-0040: guard redirects are bounded and `next` never nests (RFC 0051)

**Status:** accepted

**Context.** A guard whose redirect route sat under the same guard looped forever (`GET /login` gave `302 /login?next=%2Flogin`, and so on). Each hop nested `next` one level deeper. The server never sees a loop, because the browser follows each redirect as a new request. The client router had an 8-hop counter, but the server had no cap and `keel check` had no rule.

**Decision.**
- **`next`.** A denial carries `next: url`. When `url` is a guard's redirect route with a root-relative `next`, the denial carries that `next` instead, repeated to the innermost one. `next` is the first URL that is not a guard's redirect route. A `next` is carried only when it is at most 2,048 characters long, has no control character, and resolves to the same origin as a path; otherwise it is dropped. Unwrapping stops after 8 levels (amendment, backlog 0145, 0146).
- **E1508, one code in k.router.** A guard redirect is E1508 when its location was already visited in the request or navigation, or when it would be the ninth.
  - **Server.** It runs the target's guards in-process, hop by hop, before it answers the 302. On E1508 it answers 500 `keel.unexpected` at the denying level, with a dev `diag`.
  - **Client router.** It applies the same check to the hops it navigates.
  - **`keel check`.** It reports a guard whose literal `redirect` route has that guard in its chain. There is no fix.
- **Shared code.** `guardNext`, `withNext` and `guardLoop` are in `@keel/router/internal`.

**Alternatives.**
- **Refuse on the server by guard identity.** A guard that allows its own redirect route by `url` would be refused.
- **Unwrap every `next`.** It breaks apps that use `next` for other things.
- **A hop counter in the URL.** It can be forged, and it adds a public search key.
- **`manifest()` throws.** A manifest cannot see cross-module guards.
- **A k.server code.** It would split one behaviour across two codes.

**Consequences.**
- **Cost.** A denial costs one extra guard run for the target's guards, and nothing when the target has no guard. Guards should be read-only.
- **What the check misses.** Computed redirects and loops through two or more guards are caught only at runtime.
- **Behaviour change.** A two-route cycle in the client router now stops at the first revisit instead of after 8 hops.
