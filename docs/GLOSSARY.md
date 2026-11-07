# Glossary

Canonical names. Changing one requires an RFC.

- **kernel** — the frozen core: schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, server (thin), services (thin), ctx.
- **stdlib** — modules built on kernel extension points, versioned separately, frozen individually; packages `@keel/std-<x>`, after the kernel in dependency order (no kernel package imports one).
- **module** — a vertical slice (schemas, routes, components, handlers) with a manifest declaring its public surface.
- **deployable** — a composition of modules declared in `topology.ts` that builds to one artifact.
- **schema** — the single declaration of a data shape; source of types, validators, codecs, generators.
- **transaction** — a named, typed, pure state change `(state, payload) -> state'`; the only way to mutate a store.
- **log** — the ordered record of transactions, navigations, and resource events; basis for undo, replay, audit, sessions.
- **resource** — an async read with an exhaustive state union: loading, error, ready.
- **capability** — an effect interface on `ctx` with real, shell, and simulated implementations.
- **session** — a redacted, replayable event stream captured from a running app.
- **ledger** — the verification report; each claim sits on one rung.
- **rung** — proven, exhaustive, probabilistic, example, monitored.
- **conformance suite** — the executable, implementation-independent form of a spec section.
- **spec status** — proposed -> implemented -> conformance-covered -> frozen.
- **extension point** — schema type registry, check rule registry, capability registry, module manifest, inspector hooks (`inspector({ id, schema, read })`: a named, schema-typed section of the inspect document), output formatter registry.
- **unsafe** — the only named path around a guarantee; requires a justification string; counted in the ledger.
- **diagnostic** — the one output shape for every error, warning, and finding (see OUTPUT.md).

verified: 959a568f16e924fac59329e75c1585fe38d4c00e
