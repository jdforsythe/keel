# ADR-0210: k.routes, k.module: a page names a layout of the module that composes it (RFC 0187)

**Status:** accepted (orchestrator, decision D93).

**Context.** An app's frame links every module's pages, so its module lists them all in `deps`. A page renders in a frame by naming it in `layout`, and `keel check` required the page's module to list the frame's (E1152). A frame module and its feature modules then list each other, E1153 for every pair, and an app carries one partial frame per module.

**Decision.** A binding's `layout` may name a layout of another module when either module lists the other in `deps`: the page's module lists the layout's, or the layout's module, which composes the page, lists the page's. E1152 at `layout` fires only when neither does. A `layout` adds no `deps` edge, so E1153 sees none. `routeTable` still throws E1506 for an id it cannot find or a cycle.

**Alternatives.** Links by route id without a contract (loses the typed `Href`); a deployable-level frame in `topology.ts` (a second way to say `layout`, with an opt-out); the composing module binding other modules' pages (splits a module's routes); hrefs from the frame's loader (same `deps`, loses the brand); one module for every framed page (defeats modules).

**Consequences.** One frame in the app-level module serves every feature page. k.routes gains Conformance clause 10 and k.module clause 15, both at rung `none` until the conformance writer and the build land.
