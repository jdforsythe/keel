# ADR-0229: k.router: `pageHref` reads a string into an `Href` of a page of the route table (RFC 0207)

**Status:** accepted and implemented (orchestrator, 2026-11-23, for the operator to confirm).

**Context.** A guard redirect carries `next`, the denied request's path and query, as a string. An action's `ok` takes a branded `Href`, and nothing public turns a string into one, so the household's setup action cannot follow `next`. The household's and `examples/shell-mount`'s identity sources each wrote their own `next` check and copy the string into a 303 `location`; both admit `/\t/evil.example/x`, which a URL parser reads as `//evil.example/x`.

**Decision.**
- `pageHref(routes, text)` in `@keel/router/match`: `Result<Href, KeelError<'keel.notFound', null>>`, message `not a page`. A string becomes an `Href` only through it, a contract's `href` or an identity mount's `href`.
- It refuses text over 2,048 characters, without exactly one leading `/`, with a `\` or control character anywhere, with `%2F` or `%5C` in the path or a `.` or `..` segment once decoded, that names no page of `routes` as `matchHref` matches, or that names a guard's `redirect` route.
- Otherwise it answers the page's contract's `href(id, params, search)` for the match: rebuilt, never copied; declared search keys that parse survive, sorted; other keys and the hash drop. No base path.
- An action's args carry `routes`, the table it is served from; `handle.fn(request, ctx, { routes })`; `run` without `routes` gets `routeTable()`.
- `matchHref` is unchanged and returns no `Href`. No new diagnostic.

**Alternatives.**
- An `href` on `matchHref`'s answer, or refusals inside `matchHref`: a second, weaker string-to-`Href` path, or a changed navigation matcher for std-sessions replay.
- A boolean `isSafeNext`: the app still copies the string, and `ok` still cannot take it.
- The table bound to `ctx`: hidden state shared by two `createApp`s on one ctx.

**Consequences.** The household's sign-in and setup actions and the shell-mount example return through `pageHref` and drop their own checks. A page whose path param holds `/` or `\`, and a guard's redirect page, are never return targets: the caller's fallback applies. k.router reads `implemented` until its four new clauses are covered.
