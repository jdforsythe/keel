# RFC 0045: `Form action` is an `Href`, router internals behind `@keel/router/internal`, a symbol-keyed forms seam, no scaffold `plan`, E1205 restored; the TS7022 action cycle

Status: accepted

## Problem
Backlog 0113, 0114, 0112, and the router, forms, and scaffold parts of 0065 (docs/freeze-review.md §2 rows 9, 11, 12).
- **0113.** A `Form` rendered outside a router (server rendering) resolved its `action` route id through `latest`, a module-level map from route id to the table of the newest manifest that declared it (RFC 0041 kept it for this case only). Which table a `Form` used depended on module evaluation order, which is action at a distance (principle 2).
- **0114.** An action cannot `return ok(routes.href(...))` when the manifest holds that action (TS7022). Authors must write `const to: Href = routes.href(...); return ok(to)` instead.
- **0065 (row 12).** `@keel/router` exported `compileRoutes`, `compileTable`, `matchUrl`, `needsBare`, `parseSearch`, `runGuard`, `fieldsError`, and the types `Level`, `Located`, `Match`, `Segment`, `Table` beside `manifest()`. These are what `@keel/server` needs, not app API, and they made the frozen surface larger (principle 8).
- **0065 (row 9).** `FormState` had public `setPending`, `validate`, and `onResult` beside `<Form>`, so a second way to drive a form existed.
- **0065 (row 11).** `@keel/scaffold` exported `plan()` and `scaffold()`. They are the same function, because `scaffold` is pure and writes nothing.
- **0112.** `@keel/reactive` throws E1205 (read of a disposed computed), but RFC 0040 removed E1205 from the k.reactive Rules because no conformance test asserted it. The result is an unlisted runtime code.

## Proposal
1. **`Form action` is an `Href`.** `<Form method action form? error?>`, where `action` is `routes.href(id, params)`. The `params` prop is removed. Outside a router, `Form` renders `action` exactly as given and reads no route table. Inside a router, the router matches the `Href` in its own table to find the route, its `actions[method]`, and the decoded `params`. It throws E1505 at render when that route lacks `method` or when nothing matches. `latest` is deleted. This is the same rule as `Link to` and `navigate`: links take an `Href` only, and an id resolves only through the manifest that minted it. The alternative `routes.action(id)` would add a second minting method. A render-root option would need a server channel, and an id-plus-table lookup would still be needed inside routers.
2. **0114: the cycle stays, and the binding stays.** Removing it needs an API change that is out of this RFC's scope (see Alternatives). Two facts about TypeScript (5.9) fix the constraint:
   - The type of `routes` is inferred from the `manifest({...})` call. Checking that call reads the type of every action value in the literal.
   - The type of `updateOrder = action(decl, fn)` is known only after TypeScript checks `fn` against `action`'s parameter type. That check computes `fn`'s inferred return type from its `return` expressions. The only exception is a target return type of exactly `void` or `any`.

   So `return ok(routes.href(...))` makes the type of `routes` depend on itself. Wrapping the call does not help: `ok<Href>(...)`, a non-generic `go(h: Href)`, a thunk, or a `function` declaration each check their arguments first. The local binding works because return-type inference reads only `return` expressions, and `to` has a declared type. Components are not affected: JSX element checks are deferred, and `Form(...)` calls in golden-1 sit in arrows annotated `(): Node`.
3. **`@keel/router/internal`.** The package gains a subpath export, `./internal` -> `src/internal/index.ts`. It holds `compileRoutes`, `compileTable`, `fieldsError`, `formHandle`, `matchUrl`, `needsBare`, `parseSearch`, `runGuard`, and the types `FormSeam`, `Level`, `Located`, `Match`, `Segment`, `Table`. `@keel/router` keeps `action`, `browserHistory`, `createRouter`, `Form`, `guard`, `loader`, `manifest`, `routesArtifact`, and the public types. `@keel/server` call sites change only their import path.
4. **Symbol-keyed forms seam.** `FormHandle` is `{ readonly [formHandle]: FormSeam }`, and `FormSeam` is `{ setPending, validate, onResult }`. The unused `values` is removed from the seam because `values()` stays public on the handle. `form()` puts the seam under `formHandle`. `FormState`'s public members are those that k.forms names: `field`, `values`, `errors`, `pending`, `reset`. The symbol lives in the router because `forms` already depends on `router` (tooling/deps.json order).
5. **No `plan`.** `scaffold(op, input, files)` is the only entry point. `keel scaffold|codemod --dry-run` calls it and skips the writes. k.scaffold already describes the dry run as a CLI flag that returns the same edit set, so its text does not change.
6. **E1205 restored.** The engine's other misuse codes (E1201-E1203, E1206) are runtime-thrown Rules codes. k.check counts runtime codes as "produced by another command", and they are listed explain-only. Reading a disposed computed is the same kind of contract violation as `run` on a disposed scope (E1206). So E1205 returns to the Rules line with a Conformance clause, `keel explain E1205` gets a row, and `fixture-per-code` lists it explain-only.

## Alternatives
- **0113, `routes.action(id)` returning a typed target.** It could type `method` against the declared verbs. It is still a second minting method next to `routes.href`, and `Form` would still need a table.
- **0113, a manifest option on the server render root.** Ownership through the scope chain is not global state, but it is a channel that only the server has. Client-only and test renders would need a second path.
- **0114, `action`'s `fn` typed `(...) => void`.** This removes the cycle, as tested. It also removes the static check of the action's `Result<Href | null, ...>`, so `ok('/x')` would compile. Rejected.
- **0114, a two-phase manifest.** Phase 1 holds paths and schemas and exposes `href`. Actions are attached in phase 2, by a statement or a `void` callback, so the attachment is not part of `routes`'s initializer. This is the only typing that removes the cycle with static checks kept. It moves `actions` out of the entry. That changes the k.router Manifest, every manifest with actions (`@keel/server`, `@keel/forms`, `@keel/testing`, and golden-1 tests and fixtures), and the `@keel/check` facts. Loaders that return links have the same cycle and would need the same move. This is left as a follow-up RFC for a human decision. The current binding costs one line.
- **0065, a forms `internal` subpath instead of a symbol.** The seam's methods would stay string-keyed and callable by anyone who has the handle.
- **0112, throw an unnumbered `Error`.** E1206, its sibling, would keep a code. Two analogous misuses would get different diagnostics.

## Spec diff
- **k.router.**
  - Manifest: the example's comments are trimmed, and the `Keys:` sentence is dropped because the example shows every key and E1503/E1504 carry the constraints.
  - Links: `Link to`, `navigate`, and `Form action` take `Href` only. `routes.href`, a router, and guard redirects resolve ids only in their own manifest.
  - Execution: server-only internals are in `@keel/router/internal`, which is not public API.
  - Form: `<Form method action form? error?>`, where `action` is an `Href`. Inside a router it submits to the action of the route `action` matches.
  - Rules: the E1507 wording is shortened.
  - Conformance: +1 bullet (a `Form` outside a router renders `action` unchanged and does not intercept submit; inside one, an `action` whose matched route lacks `method` throws E1505).
- **k.reactive.** The Rules line gets E1205 (reading a `computed` whose scope is disposed). The Conformance line gets the matching clause, including a live effect that reads such a computed.
- **k.forms.** The API example uses `action={routes.href('orders.show', { id: order.id })}`.

## Conformance diff
- **router.** `fixtures.ts` and `rules-e1501-e1506.test.ts` use `Href` actions, with E1505 asserted inside a router. New: `form-href.test.ts` and `internal-subpath.test.ts`.
- **reactive.** New: `disposed-computed-e1205.test.ts`.
- **scaffold.** `fixtures.ts`, `dry-run.test.ts`, `service-file.test.ts`, and `transaction-file.test.ts` call `scaffold` where they called `plan`. No assertion is removed.
- **forms.** `fixtures.ts` uses `routes.href("notes.edit")` in a component annotated `(): HTMLFormElement`.
- **check.** `fixture-per-code` lists E1205 explain-only.

## Migration
- `Form({ method, action: 'id', params })` becomes `Form({ method, action: routes.href('id', params) })`. A component that returns `Form(...)` directly needs a return type (`(): Node =>`) when `routes` holds it (TS7022). JSX `<Form>` does not.
- Imports of `compileRoutes`, `compileTable`, `matchUrl`, `needsBare`, `parseSearch`, `runGuard`, `fieldsError`, `Level`, `Located`, `Match`, `Segment`, or `Table` from `@keel/router` move to `@keel/router/internal`.
- A hand-written `FormHandle` becomes `{ [formHandle]: { setPending, validate, onResult } }`, and `f.validate()` becomes `f[formHandle].validate()`. Only tests do this.
- `plan(...)` becomes `scaffold(...)`.
- Done in this RFC:
  - router `Form`, `createRouter`, `manifest`, `RouterCore`, `FormHandle`, `FormProps`, tests, and README;
  - `@keel/server` import paths (src and `internals.test.ts`);
  - forms `form`, `FormState`, tests, README, and conformance fixture;
  - scaffold `index`, determinism test, and README;
  - cli `scaffoldCommand`;
  - check `EXPLANATIONS` (E1205);
  - testing `route.test.ts`;
  - golden-1 `ListsPage`, `ListPage`, and `EditTodoPage`;
  - the keel and keel-forms skills;
  - the eval spec slices.

## Token impact
k.router 1478 -> 1477 (net of this RFC's +1 conformance bullet and the trims; RFC 0043 edits the same file). k.reactive 487 -> 525. k.forms +12 for the example. All are within 1,500.
