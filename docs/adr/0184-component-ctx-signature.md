# ADR-0184: k.component: the signature `(props, ctx)`, `ctx` required (RFC 0162)

**Status:** accepted (orchestrator's lane, under decision D41).

**Context.** A component is `(props, slots?: undefined, ctx?: Ctx) => Node`. The second argument carries nothing, and `ctx` is optional in `Component`, `MountOptions` and `ResumeOptions`, so components that reach an effect branch on its absence: Toaster skips auto-dismiss, typeahead loses its clock, `TableSearch` falls back to the router's ctx, and two golden components render placeholders. No generated entry or harness call reaches those branches.

**Decision.**
- A component is `(props: P, ctx: Ctx) => Node`; the `slots` argument is removed (named slots are props).
- Every caller passes a ctx: `mount` and `resume` require one, the router and server render pass theirs, the harness makes a sim ctx when given none, and the compiler passes the enclosing component's to each JSX child.
- A component that reaches no effect may omit the parameter; one that declares it declares `ctx: Ctx`, last (E1407, with a fix diff).
- Runtime ops and base elements (`If`, `For`, `Match`, `Case`, `Boundary`, `@keel/ui` elements, `Part`, `Link`, `Form`) take no ctx.

**Alternatives.** Keep `ctx?`; keep `slots` and make the third required; a context lookup (`useCtx()`, action at a distance); ctx on every runtime op (60 stdlib call sites for no read). RFC 0162 gives the reasons.

**Consequences.** Every `ctx === undefined` branch in the stdlib and the golden apps goes. Twenty-one source files change signature, rewritten directly by the build lane; 13 conformance files are rewritten under `rfc:0162`. Package budgets are measured at the build and re-based. Calling a widget from a `.ts` file passes the ctx: `Menu(props, ctx)`.
