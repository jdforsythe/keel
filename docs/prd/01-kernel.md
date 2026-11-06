# PRD B: The kernel

The smallest Keel that an agent can build a real app with, where every guarantee the thesis depends on is structural. Gates G1-G3.

## Non-goals (stdlib)
Money, Temporal, text, i18n, cache policies, auth, sessions, jobs, schedules, streams, split topology, realtime, offline, statecharts, simulator, mutation in ledger, compliance pack, headless components, tables, db, workflows, shells, verification.

## Packages and requirements

**schema.** Primitives, objects, arrays, unions, enums, optional vs nullable (distinct), branded IDs, literal types. Derives: TS types, validator, JSON codec, fast-check generator, docs. Type registry extension point. Dev-time runtime validation on props.

**reactive.** `signal`, `computed`, `effect`, `resource`, ownership scopes with automatic disposal. Dependencies from reads. Effects declare writes; cycles are static errors. No other operators.

**store.** `store(schema)`, `transaction(name, payloadSchema, fn)`, pure fn. Log of applied transactions with snapshot and restore. Undo. Path-based reads. Ownership: a component may write only through transactions it declares.

**compiler.** Vite plugin on oxc. JSX to fine-grained DOM ops. Control flow via `If`, `For` (key required), `Match` (exhaustive over unions). Artifacts: dependency graph, element-ID index, route table, a11y expectations. Static subtree hoisting. Escaping by context.

**runtime-dom.** Node creation, event delegation, islands with serialized state and resume. No VDOM.

**router.** `routes.ts` manifest: path, params schema, search schema, loader, actions keyed by HTTP method, layout, guard, errorElement. `href(route, params)` typed. Scroll restoration, focus on navigation, `<Form method action>` with automatic revalidation.

**forms.** `form(schema)` -> bindings, validation, submit, field errors from server `Result`. Named slots for loading, error.

**ui.** Token schema, typed style props compiled to atomic CSS, scoped styles. Base elements require labels at type level. Standard slots: loading, empty, error.

**ctx.** Capability registry. Kernel capabilities: `clock`, `random`, `net`, `storage`. Real, shell, simulated implementations. Bare `Date.now`, `Math.random`, `fetch` are compile errors in app code.

**check.** Strict TS, structure lint, schema checks, rule registry, axe on rendered output, diagnostics per OUTPUT.md with fix diffs for the top 30 error codes.

**cli.** `keel check|build|dev|test|spec|explain|inspect|scaffold|codemod|render|ledger`. `keel mcp` and `keel lsp` serve the same engine. Formatter registry.

**scaffold.** Project, module, route, component, store, transaction generators. Turborepo config emission. Codemods: rename, move, add-field.

**testing.** Harness: render component or route with props and state fixture; events by element ID; assert on a11y tree and serialized state. Schema-generated property tests for components and transactions. Ledger generator.

**server (thin).** Hono-based. Runs loaders and actions. Dev server with structured log stream. Static and Node adapters. Local topology only.

**services (thin).** `service({ base, schema })` -> typed client from OpenAPI, timeouts, `ApiError` union. No retry policy, cache, or auth refresh (stdlib).

## Golden app 1
Todo app with lists, filters in URL search params, optimistic adds, a settings form, one protected route with a stub guard. Client-only at G1; real API at G2.

## Freeze criteria
Every kernel spec section `conformance-covered` · extension points each exercised by one stdlib module · golden apps 1 and 2 ledger green · eval metrics improved over two consecutive releases · external review of the spec for one-way violations.
