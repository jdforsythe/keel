# Glossary

Canonical names. Changing one requires an RFC.

- **kernel**: the provisionally frozen core: schema, reactive, store, runtime-dom, compiler, router, forms, ui, check, scaffold, testing, server (thin), services (thin), cli, ctx.
- **stdlib**: modules built on kernel extension points, versioned separately, frozen individually; packages `@keel/std-<x>`, after the kernel in dependency order (no kernel package imports one).
- **module**: a vertical slice (schemas, routes, components, handlers) with a manifest declaring its public surface.
- **library**: a package marked `"keel": "library"` that ships its source and a module manifest, which an app checks and compiles as its own code; the stdlib packages are libraries (k.library).
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
- **base**: the `tokens.ts` group of style sets the compiled stylesheet applies to each element role (`page`, `heading`, `link`, `button`, `control`, `label`, `fieldError`, `summary`), with the `focus` color of the keyboard focus ring; any style prop at a use wins (k.ui).
- **look**: a named style set in the `look` group of `tokens.ts`, applied as `look="<name>"`; the element's own props replace the set's per prop (k.ui).
- **host element**: `Host` from `@keel/ui`, the one element whose node outside code owns (a chart library, d3, a standard custom element), given a schema-typed value and run by `hostCode({ mount, update, dispose })`; client only, opaque to the harness and replay, counted in the ledger (k.host-element).
- **driver**: an object passed as `createCtx({ drivers })` that supplies `storage` or `net` on a `real` or `shell` ctx and keeps that capability's contract.
- **shell**: a native package of a `client` deployable, `capacitor` (Android, iOS) or `tauri` (desktop), declared in `topology.ts` as `shells`.
- **shell target**: what a shell's package registers with `shellTarget(shell, target)` in its `./tools` entry: the shell's platforms, files, tools, plugins, build and CI jobs (k.shell); std.capacitor and std.tauri.
- **workflow**: `workflow(id, spec)` from `@keel/std-workflows`: a state chart run per instance in one server store, its steps run as jobs.
- **diagnostic**: the one output shape for every error, warning, and finding (see OUTPUT.md).
- **identity source**: `identity.server.ts` beside `topology.ts`, default-exporting `identity({ identify, handle? })`: the app's `identify` and optional `handle` mount, through which an auth library or platform tells Keel who the user is (k.user), and `identity.ts`, its `identityMount(path, { links }?)` half that pages import (k.mount).
- **declared origin**: an exact third-party origin with a reason, listed under one directive (`img`, `media`, `font`, `connect`, `frame`) of a deployable's `origins` in `topology.ts`; the one way the content security policy widens (k.origins).
- **escape**: a place where code opts out of a protection by its sanctioned name (an opt-in: `unsafe`, a declared origin, `reveal`) or goes around one (a workaround); one finding of `keel review` (k.review, k.escapes).
- **user**: the id `identify` answers for a request, `""` for no one; distinct from the anonymous `caller`, which grants nothing (k.user).
- **request log**: the list `requests()` returns of the requests a harness sent while open: `{ method, url, headers }`, header names only (k.requests).
- **replica**: `replica(ctx)` of a sim ctx, a sim ctx standing for another process on the same storage, as two replicas of a `node` deployable are (k.sim, k.persist).
- **watch**: the one optional part of a storage's contract, `watch(on)`, reporting the saves other processes commit to the same data (k.persist).
- **lifted range**: the function written as the second argument of a justified `unsafe(` call in an `unsafe/` file, where a listed set of kernel codes is not reported (k.check).
- **negative type test**: a `*.test-d.ts` or `*.test-d.tsx` file under `test/` or `conformance/`, type-checked and never run or imported, whose described `@ts-expect-error` lines each assert that a misuse does not compile; counted in the ledger as `negativeTypes`, apart from `unsafe` (k.unsafe).
- **scroll region**: `Box scroll="x"`, a named, keyboard-reachable region whose wider content scrolls inside it (k.ui, k.a11y).
- **exact form**: a plural form keyed `=n` that applies when the count is n (std.messages, std.i18n).
- **identity mount**: the path under which the identity source's `handle` answers, declared by `identity.ts`'s default export `identityMount(path, { links }?)` (`@keel/router`); a page on any deployable sends the browser there with its `href`, and a test names it as `renderRoute`'s `mount` (k.mount, k.testing).
- **drive**: how `simulate` moves a run's clock: when no work of the run is pending, to its next moment, so a scenario that awaits work waiting on the clock is answered and two runs of one `SimRun` give one trace (k.drive).
- **held work**: a capability's sim work passed to `hold(label, start)`, the work that answers through something made outside the run; it is held until delivered, holds in the order they started (k.sim, k.drive-law).
- **law check**: with `law` on (the default under `keel test`), each run of `simulate` that passed runs a second time with its `SimRun` and the two traces are compared; traces that differ fail with E1729 (k.drive-law).
- **type cache**: the results of `keel check`'s type pass kept across processes in `node_modules/.cache/keel/` (or `check()`'s `typeCache` folder), each entry keyed by content and used only when every file system question it recorded gets the same answer; it changes the time a run takes, never its output (k.check-cache).
- **defect**: a failure no caller is meant to handle (a bug in the calling code, a broken invariant, stored state that fails its own shape, a fault under a contract that throws), raised by `defect(message, code?)` from `@keel/schema`; never a `Result`'s `err`, and never passed to `attempt`'s `expect` (k.errors).
- **module root**: the scope the compiler runs a module's top-level statement in, with no parent, living as long as the module; the only root code outside the kernel gets, since a scope made while no scope runs elsewhere is E1208 (k.reactive).
- **key guard**: a type predicate that proves its type by a mark its own module set on each value (a non-exported `WeakSet`, or an own `Symbol.for` key), as `isDefect`, `isStore` and `isSchema` do; the one predicate over a type with methods that is no E1762 (k.unsafe).

subject: spec/ packages/*/package.json
verified: 73b4d1ef9220bab121ee35682833de03d269bd58
