# Future features

Ideas that come up outside the current plans. An idea is built at once only when the work in hand needs it; otherwise it waits here and the list is worked after the beta release, before 1.0 or after it. An idea taken up moves to `tasks/BACKLOG.md` with an id. Each line: the idea, where it came from, what it would need.

- A caller token for cross-site clients: the server returns the caller token in a response header, the client keeps it and sends it in a request header, so a `client` deployable on a static host that is cross-site to its API keeps one caller. From RFC 0087 (the caller cookie is same-site only). Needs a decision on where the client stores a token that `HttpOnly` withholds today, and fits an auth stdlib module.
- Serve API handlers from the `@keel/services` `endpoints` schema: one schema per API, handlers typed from it, E1561 and E1562 gone. From RFC 0086 Alternatives. Replaces `loader` and `action` for JSON; a stage of its own.
- In-entry verbs for API routes (`{ path, GET, POST }`). From RFC 0086 D2. Needs an answer to the circular initializer of ADR-0052.
- A `client` deployable served under a path prefix (a `base` option). From RFC 0087 Known limits.
