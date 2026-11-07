# ADR-0034: `Form action` is an `Href`, `@keel/router/internal`, a symbol-keyed forms seam, no scaffold `plan`, E1205 restored (RFC 0045)

**Status:** accepted

**Context.** A `Form` outside a router used a global newest-manifest map (backlog 0113). Router internals, the public `setPending`/`validate`/`onResult` seam, and `plan()` beside `scaffold()` gave second ways (freeze review §2 rows 9, 11, 12). E1205 was thrown but not in the k.reactive Rules (0112). An action cannot `return ok(routes.href(...))` inside the manifest that holds it (TS7022, 0114).

**Decision.**
- **`Form action`.** It takes an `Href` from `routes.href(id, params)`, and the `params` prop is gone. Outside a router, `Form` renders it as given. Inside a router, the router matches it in its own table, and a match that lacks the method is E1505. The `latest` map is deleted.
- **`@keel/router/internal`.** This subpath holds the server's needs: compile, match, guard run, fields error, the `formHandle` symbol, and their types. `@keel/router` exports app API only.
- **`FormHandle`.** It is `{ [formHandle]: FormSeam }`, and `form()` implements the seam under that symbol.
- **`scaffold()`.** It is the only scaffold entry point. `--dry-run` skips the writes.
- **E1205.** It is a k.reactive Rules code with a Conformance clause, explain-only for `keel check`, like E1206.
- **0114.** The `const to: Href` binding stays. A typing that removes the cycle and keeps the action's static return check must take `actions` out of `routes`'s initializer (a two-phase manifest). That is a separate decision.

**Alternatives.**
- `routes.action(id)`, which would be a second minting method.
- A render-root manifest option, which only the server has.
- A forms `internal` subpath with string-keyed methods.
- An unnumbered disposed-read error.
- A `void`-typed action `fn`, which loses the `Result<Href | null>` check.

**Consequences.**
- **Server-rendered `Form`s.** They need no table and no global state.
- **Typed `Form` targets.** A `Form` target is typed by its manifest, like a `Link`.
- **E1505 timing.** The check now runs only inside a router: at render in the client and in tests. The server answers a post to an undeclared method with 405.
- **TS7022 in components.** A component that returns `Form(...)` directly and is held by its own manifest needs a return type annotation. JSX `<Form>` does not.
- **`keel explain E1205`.** It has a row.
