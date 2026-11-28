# ADR-0179: k.contract: one contract per module (RFC 0157)

**Status:** accepted (orchestrator's lane, under decisions D41 and D42).

**Context.** An endpoint between two modules is declared by the serving module's `routes.ts` and again by each caller's `endpoints` file; k.compat E1561 compares the copies at `keel check`. golden-1 declares `/api/lists` in three caller files. Handlers repeat the route's schemas (E1507, E1512). Pages import `routes.ts`, and with it every view and handler, to build links. ADR-0052 split actions into `routes.actions` because an action returning `ok(routes.href(...))` made the manifest's initializer circular (TS7022).

**Decision.**
- Each module that serves a route has `modules/<id>/<id>.contract.ts` exporting `<id> = contract('<id>', entries)` from `@keel/router/contract`, an entry that imports `@keel/schema` only and that `@keel/services` and `@keel/std-offline` take their types from: client-safe (schemas and packages only, E1514), keyed by route id, each entry a page `{ path, params?, search? }`, a layout `{ layout: true }` or an API entry (the k.services `Endpoint` shape, one id per method).
- `routes.ts` binds every entry and nothing else, `manifest(contract, binding)` (E1515); a page's actions sit in its entry by verb, an API entry's handler under `loader` or `action`. `routes.actions` is removed.
- Handlers name their entry, `loader(contract, id, decl, fn)` and `action(contract, id, decl, fn)`, and are typed from it. E1507 and E1512 are retired.
- Links come from `<contract>.href`, clients from `service({ contract })`, `routes.json` and `surface.json` (`version: 2`) from contract and binding. `service({ module, schema })` and `public.routes` are removed; `endpoints` stays for `service({ base })`.
- E1561 is removed (unrepresentable in one build); E1562 compares a base contract's API entry with the current one. E1157 is removed.
- E1504 applies to a page's `search`; an API entry's `query` may require keys, and a failing query is 422 `keel.fields` after the guard.
- New rules E1513 (placement), E1514 (imports), E1515 (binding); E1510 is rewritten for contract and binding kinds. Where each code fires (type error, `contract`, `manifest`, `loader`, `routeTable`, `keel check`) is one table in k.routes.
- A deployable's route table is `routeTable(...manifests)` (k.routes), a frozen `{ kind: 'keel.routeTable', contracts }`; a manifest is the route table of its one module and also carries `contract`. Bindings are no public member: the kernel reads them through `bindingsOf` from `@keel/router/internal`, and stdlib code reads ids, paths, methods and schemas from the contracts. Across modules a shared path pattern is E1502 at any method.
- The router keys its table by path pattern; a pattern holds one page, or one contract's API entries at distinct methods. HEAD runs the GET entry; a method no entry has is 405 with the pattern's methods in `allow`; OPTIONS is a preflight or 405 (k.api).
- A layout's parent is named in the binding (`layout?` on page and layout bindings), never the contract: a layout id of its own contract or of another module's, whose module is in `deps` (E1152). `manifest` throws E1506 for an own id that is no layout or a cycle in the contract; `routeTable`, or a manifest served alone, for another module's id naming no layout entry of the table or a cycle across modules.
- `surface.json` v2 has the layout of k.compat; a base that is absent or unreadable is W1568.
- A stdlib module's routes reach a deployable through `routeTable`, read statically from its package's `./contract` and `./routes`; W1005 names a contract or binding part that is not literal.
- The static readers read a contract as written, for any package alike: literal keys; literal `method`, `path`, `layout` and `events`; `params`, `search` and `query` followed through consts and imports; any other member any expression. A spread or call for the entries or an entry is W1005 and E1111, so no helper returns entries; a helper may supply a member's value.
- A loader is live exactly on an API GET entry with `events: true`; a page or layout loader never is (E1515).
- `keel check` reports the type errors of E1155, E1506, E1510 and E1515 under those codes, mapped from the node where each starts in the `contract` or `manifest` argument, never from its TypeScript code; the argument types are mapped types keyed by id, so each error starts at the offending key or member. `contract` throws E1513 for an API name only; the file and folder cases are `keel check` only.
- std-sessions ships `./contract`, its one contract, the tally entry included; a contract writes a channel's two entries out, naming the schemas `channel` gives (`events`, `body`), and `channelRoute(contract, channel, opts)` gives the handlers `{ loader, action }` the binding names, declared through that contract and E1515 for an entry that is not the channel's, its channel declared in a `*.schema.ts` file; std-offline sends through `outbox(id, contract)` (std.contracts).

**Alternatives.** A stricter E1561 over two declarations; a contract for API routes only, which keeps `routes.actions` and the cycle for pages; handlers served from the caller's `endpoints` file; short contract keys; one entry per path with verb members; keeping `public.routes`; a helper's entries spread into a contract, read by evaluating the contract or by interpreting the helper. RFC 0157 gives the reasons.

**Consequences.**
- Supersedes ADR-0052: the contract holds `href` and no handler, so no handler's type depends on the table that binds it; a TypeScript 5.9.3 model in RFC 0157 shows TS7022 before and none after. The handler-before-`routes.ts` TDZ cannot occur.
- Reopens and settles RFC 0086 D2: API handlers sit in their binding entry; `method` is the tag `api: true` was.
- API route ids change where one route served two methods (`kitchen.recipes` becomes `kitchen.box` and `kitchen.add`).
- No migration: nothing is released, so the build lane rewrites both golden apps, apps/sessions, apps/inspector, std-health, std-sessions, std-channels, std-offline, the scaffold templates, the fixtures and six published skills directly, in the build stage.
- Package budgets are measured at the build and re-based; `@keel/router/contract` gets an entry set from its measured size.
