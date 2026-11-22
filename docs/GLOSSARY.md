# Glossary

Canonical names. Changing one requires an RFC.

- **kernel**: the provisionally frozen core: schema, reactive, store, runtime-dom, compiler, router, forms, ui, check, scaffold, testing, server (thin), services (thin), cli, ctx.
- **stdlib**: modules built on kernel extension points, versioned separately, frozen individually; packages `@keel/std-<x>`, after the kernel in dependency order (no kernel package imports one).
- **module**: a vertical slice (schemas, routes, components, handlers) with a manifest declaring its public surface.
- **contract**: `modules/<id>/<id>.contract.ts`, the client-safe file declaring each route of a module once (pages, layouts, API entries); `routes.ts` binds views and handlers to it, and links, clients and the module's public routes derive from it (k.contract).
- **route table**: the routes one deployable serves, `routeTable(...)` over its modules' manifests; a manifest is the route table of its one module (k.routes).
- **deployable**: a composition of modules declared in `topology.ts` that builds to one artifact.
- **schema**: the single declaration of a data shape; source of types, validators, codecs, generators.
- **transaction**: a named, typed, pure state change `(state, payload) -> state'`; the only way to mutate a store.
- **log**: the ordered record of transactions, navigations, and resource events; basis for undo, replay, audit, sessions.
- **resource**: an async read with an exhaustive state union: loading, error, ready.
- **capability**: an effect interface on `ctx` with real, shell, and simulated implementations.
- **app data**: the records an app keeps for its users in a store of its choosing, reached through a capability; the kernel validates it at a boundary and neither stores nor fetches it (k.data).
- **session**: a redacted, replayable event stream captured from a running app.
- **ledger**: the verification report; each claim sits on one rung.
- **rung**: proven, exhaustive, probabilistic, example, monitored.
- **conformance suite**: the executable, implementation-independent form of a spec section.
- **spec status**: proposed -> implemented -> conformance-covered -> frozen.
- **extension point**: schema type registry, check rule registry, capability registry, module manifest, inspector hooks (`inspector({ id, schema, read })`: a named, schema-typed section of the inspect document), output formatter registry.
- **unsafe**: the only named path around a guarantee; requires a justification string; counted in the ledger.
- **part**: `Part` from `@keel/ui/aria`, the element stdlib widgets build on; a base element whose `role` fixes its tag and ARIA props.
- **host element**: `Host` from `@keel/ui`, the one element whose node outside code owns (a chart library, d3, a standard custom element), given a schema-typed value and run by `hostCode({ mount, update, dispose })`; client only, opaque to the harness and replay, counted in the ledger (k.host-element).
- **driver**: an object passed as `createCtx({ drivers })` that supplies `storage` or `net` on a `real` or `shell` ctx and keeps that capability's contract.
- **shell**: a native package of a `client` deployable, `capacitor` (Android, iOS) or `tauri` (desktop), declared in `topology.ts` as `shells`.
- **shell target**: what a shell's package registers with `shellTarget(shell, target)` in its `./tools` entry: the shell's platforms, files, tools, build and CI jobs (k.shell); std.capacitor and std.tauri.
- **workflow**: `workflow(id, spec)` from `@keel/std-workflows`: a state chart run per instance in one server store, its steps run as jobs.
- **diagnostic**: the one output shape for every error, warning, and finding (see OUTPUT.md).
- **identity source**: `identity.server.ts` beside `topology.ts`, default-exporting `identity({ identify, handle? })`: the app's `identify` and optional `handle` mount, through which an auth library or platform tells Keel who the user is (k.user), and `identity.ts`, its `identityMount(path, { links }?)` half that pages import (k.mount).
- **declared origin**: an exact third-party origin with a reason, listed under one directive (`img`, `media`, `font`, `connect`, `frame`) of a deployable's `origins` in `topology.ts`; the one way the content security policy widens (k.origins).
- **escape**: a place where code opts out of a protection by its sanctioned name (an opt-in: `unsafe`, a declared origin, `reveal`) or goes around one (a workaround); one finding of `keel review` (k.review, k.escapes).
- **user**: the id `identify` answers for a request, `""` for no one; distinct from the anonymous `caller`, which grants nothing (k.user).

verified: 3190e26ae653272180ea7a368098f885a7615f09
