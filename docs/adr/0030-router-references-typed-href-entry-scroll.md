# ADR-0030: Guards by reference, manifest-typed `routes.href`, scroll keyed by history entry, `Image src` as an asset (RFC 0041)

**Status:** accepted

**Context.** Guards were reached through a global name table and through the server's `createApp({ guards })` registration list, which made two ways to reach a guard. `href` was a free function with a `string` id, resolved through a global newest-manifest map. Scroll positions were keyed by URL. `Image src: Href` made `keel check` report E1501 for asset literals. Router PLAN recorded these as D19, D20, D23, and backlog 0044 and 0103 track them.

**Decision.**
- **Guards.** `guard({ redirect }, fn)` returns a value, and a route holds it in `guard`. There is no name, no `guardTable`, and no `createApp({ guards })`.
- **`routes.json`.** The `guard` field holds the guard's `redirect` route id.
- **E1506.** It now means only an unknown layout, a layout with a path, or a layout cycle.
- **`routes.href`.** `manifest()` returns `href`, typed from that manifest's keys and schemas. The free `href` is removed.
- **`Form` outside a router.** The newest-manifest map remains only for this case: a `Form` rendered outside any router resolves its `action` route there.
- **History entry keys.** `RouterHistory.push`/`replace` take a key minted by the router (`k<n>`), and `onPop` delivers it back. The router saves scroll per key and restores the arriving entry's position on pop. `browserHistory` stores the key in `history.state` with a per-load nonce.
- **`Image src`.** It is typed `string`, and `safeUrl` still applies.

**Alternatives.**
- **Explicit guard ids.** This would put a second name next to the export.
- **Codegen-typed free `href`.** This needs a global registry type.
- **`RouterHistory.key()`.** Every existing in-memory history would have to implement it.
- **`ctx.random` keys.** These would shift seeded sim ids.
- **A branded asset type.** This would be a second minting API.

**Consequences.**
- **TypeScript cycle.** An action that returns a link into its own manifest must bind `const to: Href = routes.href(...)` before `ok(to)`. Otherwise `routes.ts` and the `*.server.ts` file form a type cycle (TS7022). The keel skills teach the binding.
- **Cross-module links.** These import the target module's `routes.ts`, so dependencies are visible as imports.
- **Checker and scaffold.** `@keel/check` must collect `.href('<id>'` member calls for E1157/E1152. `@keel/scaffold` rename must rewrite them.
- **Server.** The server resolves a guard's redirect through its deployable manifest (`Served.routes`).
