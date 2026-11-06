# ADR-0013: Kernel first, stdlib second, versioned separately

**Status:** accepted
**Context.** The framework must work fully before the batteries are built; a frozen core is what agents need early.
**Decision.** Kernel = schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, thin server, thin services, ctx. Everything else is stdlib on extension points, frozen module by module.
**Consequences.** Extension points are kernel work and freeze criteria; stdlib waves are ordered by what the next golden app needs.
