# ADR-0246: k.user: a sign-in returns only to a page its own origin answers; E1592 (RFC 0224)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** `handle.fn` gets its deployable's own route table, and `examples/shell-mount` joins a `servedBy` client's table so `pageHref` can name its pages. Nothing said what a sign-in returns to when the pages are on another origin. Joining such a table gives a root-relative `location` that names nothing where the browser reads it, and an absolute return URL would reopen the open redirect RFC 0207 closed. A sign-in's cookie is per origin (k.mount Origins), so a person returned to another origin arrives signed out.

**Decision.**
- A return target is a page the origin of the `handle` answers. `Href` stays root-relative; `pageHref` is unchanged and already refuses an absolute or protocol-relative `next`.
- The tables an identity source joins are those whose pages its origin answers: a `client` deployable through `servedBy`, a `node` peer through forwarding.
- E1592, an error at the import, no fix diff, in `keel check` and `keel build`: `identity.server.ts`, or a project file it imports, imports the `routes` of a module that a `static` deployable, or a `client` one without `servedBy`, serves.
- The docs show the same-origin pattern: `servedBy`, or a `node` peer reached by forwarding.

**Alternatives.**
- A typed peer page reference resolved against the peer's declared origin, giving an absolute URL brand: safe by construction, but it lands the person signed out, widens `Href` or adds a second link type, and `KEEL_PEER_<NAME>` is a server-to-server URL, not a public one. Deferred to `tasks/FUTURE.md`.
- A runtime refusal: the table carries no topology, and it fails in production where `keel check` can see it.
- Giving `handle.fn` every page its origin answers: it loads peers' page modules into the identity deployable.

**Consequences.** No runtime change and no bytes; an app with one origin or no identity source sees nothing. k.user reads `implemented` until its new clause is covered. A cross-origin sign-in flow is the auth library's, inside `handle`.
