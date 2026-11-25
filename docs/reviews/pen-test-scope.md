# Penetration test: scope and request for quote

We ask for a grey-box penetration test with source access of Keel, a TypeScript framework for web apps (a server on Node, a browser runtime, a command-line checker and build, and a standard library of packages). Keel is pre-release and heads for a public 0.x preview. The test is one of two outside reviews that gate that release; the other is an accessibility audit (`docs/reviews/a11y-audit-scope.md`). This document holds what a firm needs to quote and to start.

## What we want to learn

Keel makes written security claims in `docs/THREAT-MODEL.md`, each backed by a section of its specification. We want each claim attacked: a way to break one is a finding. Each claim also states its limits, and those limits are published on purpose. A limit listed below is not a finding; a way around a claim that its limit does not describe is.

The release gate is: no open critical, high or medium finding, and each low finding fixed or published as a residual risk in the threat model.

## In scope

### 1. The reference app on staging

The reference app is `apps/golden-3`. It does not exist yet: an agent builds it from Keel's public documentation in a later run, and we add it to the engagement when it is deployed. Until then, two existing apps stand in for it, and the test runs against them if it starts first:

- `apps/household`: a shopping list and receipts book shared by the members of a home. One `node` deployable renders pages on the server. It signs people in through Better Auth plugged into Keel's identity seam, mints and checks API bearer tokens (`@keel/std-tokens`), keeps data in Postgres (`@keel/std-postgres`), and serves session-capture ingest (`@keel/std-sessions`).
- `apps/golden-2`: a recipe box in three locales. A `client` deployable (routing, loaders and pages in the browser) is served by a `node` deployable `api` that holds the JSON API, sign-up and sign-in pages, API tokens, the sign-in library at `/api/auth` and a health route.

Between them these exercise server-rendered pages with islands, a browser-routed client, forms and actions, guards, API routes with bearer tokens, the identity mount, the caller cookie, live data, durable storage and session capture.

### 2. The output of `keel scaffold`

A new project written by `keel scaffold project <name> --adapter node`, `--adapter client` and `--adapter static`, with one module, one route with a loader, and one API route (`keel scaffold route <id> --path <path> --api`), built with `keel build` and run as built. We provide the three generated projects in the repository and on staging. The question is whether a new app starts safe: its headers, its policy, its generated deploy files (`deploy/`, a Dockerfile and a compose file), its `.gitignore` and its generated CI.

### 3. The docs site

The site is not built yet. It is added to the engagement when it exists, as a static Keel deployable on the same staging host.

### 4. The framework's claims

Source review of the kernel and standard library packages under `packages/`, aimed at the claims below. Each line is a testable statement, with the threat model section that makes it and the specification section behind it (`keel docs <section>` prints one).

| # | Claim | Threat model section | Spec |
| --- | --- | --- | --- |
| C1 | Output is escaped by default. One URL policy covers `href`, `src`, `action`, `formaction`, `xlink:href`, `poster` and `ping` (http, https, mailto, tel only), and `srcdoc` is always `about:blank`. | Output | k.security |
| C2 | A link Keel follows is a same-origin path (`Href`): a redirect target that is not one is a 500 with no `Location`, and the client router follows none. | Links | k.router, k.forms |
| C3 | An `s.secret` value serializes and logs only as `"[secret]"`, never restores from JSON, and is read only by `reveal` in a `*.server.ts` file; no secret reaches store state, storage, a database, a job input, a channel message or an outbox body. | Secrets | k.privacy, k.reveal |
| C4 | The server log scrub finds each secret and `.pii()` value of a request's scope as given, in NFC and NFD, as hex and as base64 at any alignment (from 8 bytes; a shorter value as its own padded base64), in the text and in decoded views that undo `%` escapes, `+`, JSON escapes and HTML entities, one family at a time and together, so any single or double nesting of those encodings is found. Past 65,536 bytes of a scope's distinct values, or in a text over 2,000,000 characters, everything after the server's prefix is one mark. | Secrets, Server log | k.privacy, k.serverlog |
| C5 | A value `parse` accepts is plain data, but for the `Secret` at each `secret` node: a `Map`, a `Set`, a class instance, a function, a symbol key, a non-enumerable key or a getter is refused at a declared position, inside `s.json()` and under an undeclared key of an open object at any depth. | Secrets | k.schema |
| C6 | A log record cannot be forged: control characters, U+2028, U+2029 and `…` are written as `\u` escapes, fields are cut at stated lengths with a marker input cannot forge, and a record has a stated size cap. | Server log | k.serverlog |
| C7 | No byte of a server-only file (`*.server.*`, `*.guard.*`) and no environment value other than the public peer origins is in a browser asset on a `node` or `static` deployable; `keel build` stops on any `keel check` error. | Server and client split | k.boundary, k.bundle |
| C8 | Built assets are read once at startup from a fixed set; a request path never reaches the filesystem, and no symlink or `..` entry leads out of `assets/`. | Server and client split | k.hosting |
| C9 | Every document carries a content security policy with a per-response nonce, `default-src 'none'`, no inline script other than the JSON state, and Trusted Types (`require-trusted-types-for 'script'`, policy `keel`). Only five directives can be widened, each by an exact origin with a reason in `topology.ts`; `script-src`, `style-src` and Trusted Types take no declaration. A frame of the app's own origin is refused. | Content security policy | k.security, k.origins |
| C10 | The CSP report endpoint takes at most 16 KiB per body, logs at most 100 reports in 60 s, and logs no path, query or sample. | Report endpoint | k.security |
| C11 | A write needs same-site proof, else 403; submitted values drop `__proto__`, `constructor` and `prototype`; a body over `maxBodyBytes` is 413 and nothing runs. | Writes | k.server |
| C12 | A cross-origin API call is granted only to an exactly listed origin on a route declared `api: true`; pages, assets and unlisted origins get no CORS header. | Allowed origins | k.hosting |
| C13 | The page's state script carries only the stores an island needs; no server store restores from it; a write key read from a page commits nothing new. | State in the page | k.store, k.sync |
| C14 | Forwarding to a peer follows no redirect, caps the body, drops hop-by-hop headers and refuses a path starting `//` or `/\`. | Forwarding | k.hosting |
| C15 | An event stream runs its guards first, ends on abort, and sends no event over 1,048,576 bytes. The server caps open streams per app (default 1,000). Channel streams are capped per user, else per caller (default 8), and all anonymous opens on every module's channel routes in the process together (`perAnonymous`, default 64); a signed-in person's opens never count against the anonymous pool. | Event streams | k.services, std.channels-limits |
| C16 | The caller cookie is `HttpOnly; SameSite=Lax`, `__Host-` with `Secure` on https, HMAC-signed under `KEEL_SECRET`; an unsigned value counts as none; loaders see only its SHA-256. | Caller identity | k.user |
| C17 | Identity is opt-in: an app without `identity.ts` has no user. Keel authenticates no one; `user` comes only from the app's `identify` or from an `x-keel-user` assertion another deployable signed under `KEEL_SECRET` (bound to method, path, search, body and receiver, valid 60 s), never from a client value. An `identityMount` call anywhere but `identity.ts`'s default export is a check error (E1593), and a mount path at or under `/assets` is refused (E1579). | Identity | k.user, k.mount |
| C18 | An API route's bearer token reaches handlers only as a `Secret`, is scrubbed from the log wherever it appears and is never kept; a response to a request carrying one is `no-store`. | Bearer | k.api |
| C19 | A minted token holds 256 random bits; `check` compares in constant time and refuses an expired token; a simulated ctx's tokens are refused by a real one. | Tokens | std.tokens |
| C20 | Outside dev, an unexpected error shows as `unexpected` with no data. | Mode | k.errors |
| C21 | An uncaught exception writes one record with no error text, and production stops, drains and exits. | Uncaught errors | k.server |
| C22 | Session capture records no `s.secret` field, password input, `redact` entry or undeclared key; uploads go only to the document's origin; `sessions.list` admits only listed readers. | Sessions | std.sessions |
| C23 | An outbox write of another owner is refused and never stored. | Outbox | std.offline, std.outbox-owner |
| C24 | `keel check` refuses what it cannot read where a guarantee depends on reading it: an unreadable `topology.ts` (E1552), an unreadable route table, `params` or `search` (E1111), an unreadable store state schema in client-reachable code (E1107), unreadable `styles` (E1823), a type reference directive or a foreign `ImportMeta` declaration (E1016), and a relative import that resolves outside the project (E1015). | Server and client split, Personal data | k.boundary, k.privacy, k.leave, k.topology, k.aria |
| C25 | `keel review` lists each escape from these claims, by name or by shape, and fails CI on a new one; its baseline is read at the range's base. | Review | k.review, k.escapes |
| C26 | The evidence bundle holds no app value and verifies against its Ed25519 signature. | Personal data | k.evidence |

### Stated limits (not findings)

Each limit below is published in `docs/THREAT-MODEL.md`. Report one only if the behavior goes past what the limit says.

- **Scrub.** Three or more escapings; escapes the decoder does not read (`\x`, octal, `\U`, `%u`, other named entities, a numeric entity without `;`); one family's escape under two escapings of two other families where one leaves it as is; a copy part NFC and part NFD; compatibility forms; hex or base64 of an escaped copy; base64 with line breaks; hex under 8 bytes or a short base64 inside a longer encoding; any other encoding, a hash or ciphertext; a copy cut, split or changed. A value revealed outside every request scope; a secret a runner's in-process request makes; a `req` path no route lines up with.
- **Not tracked by `keel check`.** A revealed value carried through a helper's parameter, a callback or an import, `enqueue`, a response; a credential parsed as `s.string`, which is plain data from the start. A schema the checker answers `unknown` for is not reported; a URL `fetch` call it cannot read (E1570, E1571) is not reported, and the policy blocks it at run time.
- **Parse.** A Proxy is judged by what its traps answer while `parse` reads it; a value changed after `parse` returns is not judged again. A JSON body within `maxBodyBytes` may nest deep enough to make a serializer throw, which ends the request as `keel.unexpected`.
- **Bundle.** A secret hard-coded in a file that is not server-only ships when a browser file imports it; files a project plugin bundles itself, files in `public/` and values a plugin writes are the project's.
- **CSP.** A declared `connect` origin can receive anything the document holds; a declared origin sees each visitor's address. An `<a href>` the app writes is under the URL policy only, which admits `//host` and http(s).
- **Streams.** The app-wide stream cap is one pool with no per-caller share, so one client can fill it; a caller cookie costs one write, so per-caller caps do not stop a client that writes. Per-address limits belong to the proxy in front of the app. Anonymous session ingest is one bounded buffer a flood replaces.
- **Caller cookie.** Over plain http, or behind a proxy that sends no `x-forwarded-proto` while `secure` is unset, a sibling host can plant a signed cookie (fixation). The cookie is not authentication.
- **Identity.** Whoever holds `KEEL_SECRET` can assert any user to every deployable; a captured `x-keel-user` replays that one request until it expires; a stream keeps the user it opened with. Cookie attributes, rotation, fixation defense and revocation of a sign-in belong to the auth library.
- **Tokens.** No key in the stored digest, so someone who can write the database can plant one; revocation is deleting the row.
- **Storage.** Encryption at rest is the database's or the disk's.
- **Developer tools.** `keel check`, `keel build`, `keel dev` and the editor's language server import the project's `@keel/std-*` dependencies: opening a checkout runs its stdlib packages, as `pnpm test` would. `keel review` does not see an escape reached through a value from another file, in a dependency's published code, or that depends on runtime data.

## Out of scope

- **The sign-in library.** Better Auth, which the stand-in apps plug in, is a third-party project; Keel is not an auth library and does not roll its own. Its use through Keel's identity seam is in scope (C17); a flaw inside it is reported to its maintainers.
- **The staging host's platform.** The cloud account, its network and its control plane. Headers and TLS as the app serves them are in scope.
- **Volumetric denial of service.** Flooding the host. Resource exhaustion inside the app's own stated caps (C10, C15, C11) is in scope.
- **Native shells.** Capacitor and Tauri builds. No native build has run on a device, and the threat model says the native cookie store is unproven; a test there would report a known gap.
- **Social engineering, physical access, the maintainers' accounts.**
- **Third-party dependencies' own code**, except where a Keel claim depends on it.

## Method

- **Grey box with source access.** Read access to the repository at a fixed commit, which we name at kickoff, and the staging deployments built from that commit.
- **Accounts and data.** For `apps/household`: three accounts, two members of one household and one of another, each with an API token, and a household seeded with items and receipts. For `apps/golden-2`: two accounts, each with an API token, and seeded recipes. The same for `apps/golden-3` when it replaces them. We give each account's credentials through a channel agreed at kickoff, never in the repository.
- **Attack classes wanted.** Cross-site scripting and CSP or Trusted Types bypass; injection, including prototype pollution through parsed input; cross-site request forgery against the same-site proof; open redirect and navigation outside the origin; broken access control between users and between households; forging or replaying the caller cookie and the signed `x-keel-user` assertion; leakage of a secret or a `.pii()` value into the log, the page state, a bundle, error text or a session recording; server-only code or environment values in browser assets; path traversal in asset serving; header and policy misconfiguration; request smuggling or header abuse through forwarding between deployables; resource exhaustion within the stated caps; source review of `keel check` and `keel build` for a program that passes the gate while breaking a claim above.
- **Severity.** CVSS 4.0, or the firm's own scale mapped to critical, high, medium, low and informational, stated in the report.

## Deliverable

A written report. For each finding: a title, its severity and how it was scored, the steps to reproduce against staging or a test case against the source, the claim (C1 to C26) or the attack class it breaks, and a suggested fix where the firm has one. A summary of what was tested and how deeply, including the claims tested and found to hold. One retest of every finding after we fix it, with an updated report, is part of the engagement.

## How findings are handled

Each finding becomes one tracked line in the project's backlog the day the report arrives, with its severity and the report's reference. Critical, high and medium findings are fixed before release; each low finding is fixed or published as a residual in `docs/THREAT-MODEL.md`. A fixed finding goes back to the firm for the retest. We publish the report, or a summary the firm approves, with the 0.x release.

## What the firm gets from us

- The staging addresses of each app and of the scaffold output.
- Read access to the repository at the named commit.
- The test accounts and seeded data above.
- The evidence bundle `keel evidence` writes for each app: a signed directory with the check and ledger records, the headers and policy each deployable serves, where personal data is and how each sink redacts it, and the production dependencies.
- `docs/THREAT-MODEL.md`, `SECURITY.md` and this document.
- One technical contact who answers questions from the repository during the test, named in the engagement letter.

## What we need in the quote

Effort in person-days and the price, the earliest start date, the length of the test window, the retest terms and how long they stay open, the severity scale, whether the report may be published, and the testers' experience with Node web frameworks, browser security policy and source-assisted testing.

subject: docs/THREAT-MODEL.md SECURITY.md spec/kernel/k.security.md spec/kernel/k.privacy.md spec/kernel/k.serverlog.md spec/std/std.channels-limits.md apps/household apps/golden-2
verified: 5132ef10
