# Compliance

This page is for two readers: the author of a Keel app, and the auditor or pen tester who checks it. It says what the kernel enforces for accessibility, the content security policy and personal data, what the app has to declare, how to make and verify the evidence bundle, and what is left to a person. The rules themselves are spec sections: `pnpm spec k.a11y`, `k.security`, `k.privacy`, `k.evidence`.

## Accessibility (WCAG 2.2 Level A and AA)

**Checked by `keel check`.** Required props are in the `@keel/ui` types (E1802): `Heading level`, `Image alt` or `decorative`, `label` on `Input`, `TextArea`, `Select`, `Checkbox` and on `Box as` `nav` or `aside`, text in every `Link` and `Button`. Text whose `fg` falls below 4.5:1 against its own or an ancestor's `bg` in the same component is E1804 (3:1 at 24px, or 18.66px at weight 700). A reversed `direction` over two or more focusable elements is E1820. No base element takes `tabindex`, and the style vocabulary has no `order`, `position`, `z-index` or `outline`, so focus order is document order and the browser's focus ring stays.

**Checked at render.** Every `render` and `renderRoute` in `@keel/testing` runs axe-core 4.14.0 with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` rules plus `landmark-unique` (E1703). A `renderRoute` page is a document with `<html lang>`, `<title>` and a `main` landmark, so it also runs `document-title`, `html-has-lang`, `landmark-one-main`, `region` and `bypass`. Contrast is computed from each element's token classes per color scheme and breakpoint (E1804), since happy-dom has no layout. A control bound to a `.pii()` field without `autocomplete` is E1821. An axe result of `incomplete` counts as not run. `focusOrder()` on a harness handle lists the focusable ids in order, so a test can pin the order of a form. After a client navigation the router focuses the new page's first `h1`, else `main`.

**Claims.** `keel test` writes every render check to `reports/a11y.json`, and `keel ledger` turns it into one item per route and criterion, `a11y:<routeId>#<criterion>`. The item is at `example` when a passing `renderRoute` test rendered the route and every rule mapped to that criterion ran with no violation; otherwise it is at `none`, and `keel ledger --diff` reports a lowered claim as E1706. A claim is about the checks: `a11y:shifts.show#1.1.1` at `example` says every image on the page has a name, not that the name is a good one.

**What the author owes.** One `renderRoute` test per page, with each page in the state a person sees it; a route nobody renders claims nothing. `autocomplete` on every input that asks for the user's own data (`name`, `email`, `tel`, `street-address`, ...), and `off` where the data is someone else's. Names, alt text and copy that make sense to a person. Every criterion no rule maps to (most of 1.2 captions, 2.2 timing and 3.3 input assistance) is listed in the bundle's `a11y.json` for a person to check, and is never claimed.

**Limits.** Contrast is read from tokens, not pixels, so text over an image or under an overlap is not seen; run axe-core's own `color-contrast` in a real browser once per release. Screen reader behavior is not tested.

## Content security policy and headers

**What the server sends.** Every response from `createApp` carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off camera, microphone, payment and USB; over https it adds `Strict-Transport-Security`. Every document of a `node` deployable carries one fixed policy with a nonce that is new per response:

```
default-src 'none'; script-src 'nonce-<n>' 'strict-dynamic'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none';
object-src 'none'; require-trusted-types-for 'script'; trusted-types keel; report-uri /__keel/csp; report-to keel-csp
```

The policy has no option, so no app can widen it. Where the browser has Trusted Types, the runtime builds its compiler HTML through the one policy `keel`, and any other string assigned to an HTML sink throws. In dev the same policy is sent as `Content-Security-Policy-Report-Only`, with `'unsafe-inline'` in `style-src` for Vite's injected styles.

**What it means for app code.** No inline script, no `<style>` element, no `style` attribute and no `on*` attribute: style comes from tokens, behavior from event props. No other origin: a literal absolute `http(s)` URL in `src`, `action` or `Image src` is E1570, and one given to `ctx.net.fetch` or `service({ base })` in client-reachable code is E1571. Fonts and images are served from the app's own origin.

**Reports.** Browsers post violations to `POST /__keel/csp`, which logs one `csp` record per report with the directive, the blocked origin (or `inline`, `eval`, `trusted-types`) and the route id. It logs no path, query or script sample, caps a body at 16 KiB and logs at most 100 reports per minute.

**What the deployer owes.** A stable `KEEL_SECRET` of 32 or more bytes, https in production (the caller cookie is then `__Host-keel-caller` and `Secure`), and no shared cache in front of documents, since each one carries its own nonce. A `client` or `static` deployable is served by a host Keel does not run: `keel build` writes the policy it should send to `dist/<name>/csp.txt`, and sending it is the host's job.

## Personal data

**The mark.** In a `*.schema.ts` file, `.pii(class)` marks a field and everything under it as personal data, with one class from `name`, `contact`, `location`, `identifier`, `financial`, `special`, `network` and `content`. The mark changes no type and no derivation. `piiPaths(schema)` lists the marked paths and `piiValues(schema, value)` the marked values, both from `@keel/schema`.

**Where marked values are redacted.** Sessions recorded with `@keel/std-sessions` hold generated values in place of marked ones, and error messages drop them. A control bound to a marked field carries `data-k-pii`, and observers see its input as `x` repeated, as for a password. A server `diag` record holds `[pii]` in place of each marked value of the request's input, loader outputs and store states, and `[secret]` in place of each secret a request or a runner makes or reveals, in the record's message, its frames and the `req` path. A value revealed outside every scope and kept as plain text is in no scope, and a front server logs a forwarded path as it came. The evidence bundle holds no app value. A marked field in a route's `params` or `search` is E1111, because a URL reaches browser history and proxy logs that nothing can redact. In dev, `/__keel/inspect` shows store values unredacted to the developer.

**What the author owes.** Mark every field that holds a person's data, in every schema that carries it: the stored record, the form's draft and any route data. A value copied into an unmarked field, or derived from a marked one (`email.toUpperCase()`), is not redacted. A path no route declares (a 404) is logged as requested, and so is a value that fails a plain param's schema. Data with no schema, such as a raw element value, goes in the module's std.sessions `redact` entries. A canary test makes the coverage concrete: fill every path `piiPaths` lists with generated values, drive the app, and search the log lines (`createApp({ log: { write } })`), the recorded session and the sim `session` capability's `taken()` for them.

**Data at rest.** A store persists as its snapshot, so a `.pii` value sits in `ctx.storage` as the store holds it: in `.keel-dev/` files, in the SQLite file or Postgres database `@keel/std-db` opens (`storage: 'sqlite'` or `'postgres'`, `KEEL_DATABASE_URL`), or in a shell's native store. Keel does not encrypt it; encryption at rest is the database's or the disk's, so turn it on there. The driver prints no stored value, and `KEEL_DATABASE_URL` is never printed. A `Secret` never reaches storage, but what `reveal` returns is plain data. E1112 reports a revealed value reaching a log, storage, a file, store state or a throw in the same file, through the standard conversions and encodings too (`btoa`, `Buffer.from`); it follows nothing through a helper, a callback or an import. Store a salted `scrypt` hash of a credential and check it with `timingSafeEqual`. A value removed from state leaves the database once its last log entry folds past `logLimit`.

**Credentials.** A password is stored as what `credentials(ctx).hash` returns, in a field of type `Hashed`: a salted `scrypt` hash at N = 2^17 or the higher cost the app sets, never the password. A token is stored as the `Digested` that `credentials(ctx).mint` returns, with its expiry inside; the token itself is sent once and kept nowhere. Both are in `@keel/std-credentials`. What the author owes: parse every password and presented token as `s.secret`, give every reset and invite token a `ttl`, and keep `Hashed` and `Digested` fields out of loader outputs.

## The evidence bundle

**Make it.** Generate an Ed25519 key once (`openssl genpkey -algorithm ed25519 -out evidence.key`), keep it out of the repository, and publish its `keyId` where auditors can find it. In CI, after `pnpm audit --json > audit.json`:

```
KEEL_EVIDENCE_KEY="$(cat evidence.key)" keel evidence --audit audit.json
```

The command runs `test`, `check` and `ledger`, makes no network request, and writes `evidence/<date>/`: `manifest.json`, `manifest.sig`, `check.ndjson`, `ledger.ndjson`, `a11y.json` (claims, the criteria left to a person, the contrast table), `security.json` (the headers and policy each deployable sends), `pii.json` (every marked path, each sink and the share covered) and `deps.json` (production dependencies as CycloneDX components, with the audit's advisories). A run with check errors or failing tests still writes the bundle, then exits 1 with E1060, so the bundle shows the state as it is. A missing or non-Ed25519 key is E1061 and writes nothing.

**Verify it.** `keel evidence --verify evidence/<date> --key <keyId>` checks the signature and the key id (E1063), re-hashes every listed file, rejects any unlisted one (E1062) and parses each with its schema. The signature proves the files are unchanged since a holder of the key signed them; who holds the key is the project's own process.

## What the audit and the pen test cover

Keel's checks stop where a person's judgment starts. Before a release, the app goes to an accessibility firm for WCAG 2.2 AA with a desktop and a mobile screen reader, starting from the criteria `a11y.json` leaves to a person, and to a pen-test firm for OWASP ASVS level 2. Both receive the verified bundle and its `keyId`, `docs/THREAT-MODEL.md`, an https deployment and one browser profile per role. The pen test covers access control, CSRF (the write proof), XSS (escaping, the policy, Trusted Types), headers and the caller cookie, personal data in logs, sessions and `/sessions/list`, and the documented caps on bodies, the report window and the session ingest. A finding on a criterion the ledger claimed at `example` also adds the rule or test that would have caught it.

verified: c2a004b076a11c3b9c5cded38deed22cc5d9f9cb
