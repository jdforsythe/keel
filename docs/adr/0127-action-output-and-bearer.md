# ADR-0127: An API route's action answers data by its `output` schema; an API route's handlers get the `Authorization: Bearer` token as a `Secret` (RFC 0104)

**Status:** accepted (user, 2026-11-16: D1, D5, D6, D7 and D8 as written, RFC 0104 Questions 1 to 5 as recommended; the orchestrator accepted Questions 6 to 9 under the RFC defaults cited).

**Context.** RFC 0103 built `@keel/std-credentials`: `mint` gives a token as a `Secret<string>` and `check` checks a presented one. Two kernel paths around it were missing. An action returns `Result<Href | null, KeelError>`, so the write that mints a token cannot answer with it; RFC 0103's example sends it through a mail service. No request header reaches a guard, loader or action, so a token arrives in a POST body, and a GET has no place for one but the URL. On an API route, `Href | null` was already a string a script read as data, since an API route never redirects, and `.keel/surface.json` recorded every action's answer as that. The server's preflight allowed `accept, content-type, x-keel`; its log scrub covered a request's `.pii()` values and the secrets in its decoded input; a loader's JSON answer carried no `Cache-Control`.

**Decision.**
- D1: an API route's action declares `output`, a schema, and its `fn` returns `Result<T, KeelError>` for the schema's type. A page's action declares none and keeps `Result<Href | null, KeelError>`, which means navigation. Each side refuses the other with E1512, a type error at `routes.actions` that `routes.actions` also throws. A write with nothing to answer declares `output: s.object({})` and returns `ok({})`.
- D2: the answer is the runtime `Result` JSON k.server already writes: 200 `application/json` with `{ "ok": true, "value": <encoded> }`. The value is parsed by `output` before any store is saved; a refused value is E1554 and a 500 with nothing saved; a save conflict is 409 `keel.conflict` and the value is never sent. Every write's answer is `Cache-Control: no-store`.
- D3: a `module` service decodes the value with its endpoint's `output`, as before. `.keel/surface.json` records an API action's answer as its `output`, so E1561 and E1562 compare data. `Form` and the client router post to pages only and do not change. No OpenAPI export exists; one would derive from `output`.
- D4: `action()` and `loader()` throw E1113 for an `s.secret` node in `output`, since a secret encodes as its marker. A token leaves as `reveal(token)` into an `s.string()` field in the action's `*.server.ts` file; a `return` is not an E1112 sink. A `.pii()` value in `output` joins the log's `[pii]` scrub, as a loader's output does.
- D5: an API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header. A page's action has no `bearer` in its type; a page's guard and loader get `undefined`. No other header reaches server code.
- D6: the trimmed header value is `Bearer` in any letter case, one or more spaces, and a token68 of 1 to 4,096 characters. Anything else, two headers included, is `undefined`, with no error status and no log line. The server parses it with `s.secret(s.string())` before app code runs and adds its text to the request's `[secret]` scrub set.
- D7: `bearer` and `caller` are independent and the caller cookie rule does not change. The same-site check of a write does not change: a browser sends `authorization` cross-origin only after a preflight, which only an allowed origin on an API route passes. The preflight allows `accept, authorization, content-type, x-keel`. An API route's answer to a request carrying `authorization` is `Cache-Control: no-store`.
- D8: a services client call takes `bearer?: Secret<string>` and sends `authorization: Bearer <token>`; a token outside D6's form is `api.input` at `bearer` and nothing is sent. std.offline's `send` takes no `bearer`, since an outbox entry persists.
- D9: tests send the header on a `Request` to `createApp`, or pass `bearer` to a service call under a sim ctx. `renderRoute` gains nothing. Direct `run` calls may leave `bearer` out. A shell's driver forwards the header; a shell has no place to keep a token across launches.
- D10: left out: a general `headers` object (PRINCIPLES 1, 2, 4), other schemes, a kernel 401, `output` on page actions, a caller made from a token, an OpenAPI export.
- Codes: E1512 (k.api), E1113 (k.privacy). No KeelError code. Spec: k.api, k.server, k.guards, k.privacy, k.reveal, k.hosting, k.services and k.compat change; no section is created and the map does not change.

**Alternatives.**
- `output` optional on API actions, `Href | null` kept without it. Rejected: two answer shapes on one route kind (default 2). It is the user's choice against a migration of golden apps 1 and 2.
- `output` on page actions, with `Form` handing the value to the page. Rejected: a second way to do what a service call to an API route does.
- A separate `apiAction()`. Rejected: two names for one concept; `output` is the declaration.
- `s.secret` in `output` encoding as its revealed text. Rejected: it breaks "a secret never serializes", the browser cannot read a `Secret`, and the `reveal` a reviewer searches for would disappear.
- E1113 as a type error. Rejected for now: the recursive type costs compile time on every declaration; the throw fires on import.
- `s.null()` to keep `ok(null)` on the wire. Rejected: a schema change to avoid a mechanical migration.
- `bearer` on every route. Rejected: page loaders would become a token-readable data API beside API routes.
- A `headers` object, or headers declared per route. Rejected: a second way per header, and input that depends on another file.
- A 400 or 401 for a malformed header, or a kernel `keel.unauthorized`. Rejected: the denial is the app's, and a malformed header would become log lines any client can write.
- Exempting bearer requests from the same-site check. Rejected: it relaxes a rule and closes nothing.
- `bearer` as a `service()` option. Rejected: one token per client at import, with no source for it.

**Consequences.**
- A script, another service or a page's own code can get data back from a write, typed by a schema, and a minted token reaches its client only when its digest is saved.
- A token can be presented on any API route method, GET included, without entering a URL, a log or a cache.
- Golden apps 1 and 2, std-sessions and std-channels migrate: each API action declares `output`, `ok(null)` becomes `ok({})`, and readers expect `{}`. `keel check` lists the endpoints left (E1561).
- k.api grows to 1,465 tokens; k.server stays at 1,494 by trimming its Build pointer; every section stays under 1,500 and the map at 1,198.
- `output: s.object({})` types its value as `{}`, so a mistaken value is caught by the run-time parse (E1554), not by `tsc`.
- A revealed token is plain data in the client from the answer on; keeping it out of stores is the page's job, written in `keel-compliance`.
