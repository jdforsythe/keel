# RFC 0001: ctx: single typed accessor for registered capabilities

Status: draft

## Problem
`register()` exposes a capability two ways: `ctx[name]` and the returned typed accessor. Principle 1 (one way) allows one. Re-registering the same name on HMR or re-import throws E1602. Every registered capability receives the raw ctx seed, so streams correlate.

## Proposal
- The returned accessor `(ctx) => Impl` is the only access path; `ctx[name]` is not attached.
- `register(name, impls)` called again with the same name and the identical `impls` object (reference equality) returns the original accessor. A different object still throws E1602.
- Each registered capability's seed is derived from the ctx seed and its name (name hashed into the seed).

## Alternatives
- Keep `ctx[name]` only: loses static typing without casts.
- Keep both: violates Principle 1.
- Structural equality for idempotence: costly and ambiguous for functions.

## Spec diff
spec/kernel/k.ctx.md registry sentence: the accessor is the only access path; re-registering the same name with the identical implementations object is idempotent; E1602 otherwise; seeds are derived per name.

## Conformance diff
- "registered capability is exposed as ctx[name] and listed" becomes "registered capability is reachable through the returned accessor and listed".
- Add "re-registering the same name with the identical implementations object is idempotent"; E1602 for a different object is kept.

## Migration
No known consumers read `ctx[name]`; use the accessor. Sim streams of registered capabilities change (new derived seeds); kernel capability streams are unchanged.

## Token impact
Negligible; one fewer access path to document.
