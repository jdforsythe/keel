# RFC 0083: S6 Compliance: accessibility claims, strict CSP, personal data and the evidence bundle

Status: draft. Stage design RFC for S6 (`tasks/PROGRAM.md`, task 0312). Implementation waits for the S2 to S5 pushes. It applies WORKFLOW RFC defaults 1 (seven kernel gaps get kernel changes, K1 to K7, specified in four new kernel sections: k.a11y, k.security, k.privacy, k.evidence), 2 (one way: axe-core replaces the harness's own four rules, and a schema mark, `.pii(class)`, replaces the schema-path subjects of std.sessions' `redact`), 3 (the harness's render check, the check pipeline, std.sessions' redactor, the ctx observer's password mask, the ledger record and the k.cli operations are reused, not duplicated), 4 (personal data never reaches a session, a log, an error text or the bundle; a CSP report logs an origin and a route id), 5 (the policy, the report window, the organizer list and the signing key stay on the server or in the environment), 6 (the policy has no option; personal data in a URL, a reversed focus order and a personal input without `autocomplete` are errors, not advice) and 7 (`@keel/cli`, `@keel/schema` and `@keel/std-sessions` size budgets are re-based; no threshold is lowered). Measurements are from commit `c449c0c` with RFC 0080's and RFC 0081's spec text applied; the orchestrator re-measures when it writes the text into `spec/`.

## Problem
S6 must let an outside accessibility auditor and an outside pen tester check a Keel app, and hand them evidence the framework produced rather than assertions. Its exit proof is golden app 3 passing both. These gaps block it (evidence from the code as of this RFC):

1. **The accessibility claim outruns the machinery.** `docs/A11Y-TARGET.md` says `render` "runs axe-core rules" and k.testing says the harness "runs axe". `packages/testing/src/internal/axe.ts` is four structural rules of its own (`image-alt`, `button-name`, `link-name`, `label`; its comment: "axe-core is not a dependency"). axe-core 4.14.0 is a devDependency of `@keel/ui` and runs in one conformance file (`packages/ui/conformance/base-elements-axe-core.test.ts`), under happy-dom 21.0.4, with `color-contrast` disabled because happy-dom computes no colors (principle 11).
2. **Contrast is checked on one element at a time.** E1804 fires only on an element that sets both `fg` and `bg`; text whose background comes from an ancestor is never checked, and large bold text (18.66px at weight 700) gets the normal threshold. Measured on `brandTokens`: `textSecondary` on `surfaceLow` is 4.36:1, below 1.4.3's 4.5:1; `textSecondary`, `verified` and `error` on `surface` are 4.59, 4.76 and 6.15:1, where `docs/BRAND.md` states 5.2, 5.1 and 5.4.
3. **Focus order and focus after navigation are unowned.** `direction` takes `row-reverse` and `column-reverse` (`packages/ui/src/types/StyleValues.ts:26`), so visual order can run against focus order with no diagnostic (1.3.2, 2.4.3). After a client navigation the router changes the title and `lang` and "writes nothing else" (k.head), so focus stays on a link that may be gone.
4. **No input purpose.** `Input` has no `autocomplete` (`packages/ui/src/elements/Input.ts`), so a sign-up form cannot meet 1.3.5 (Identify Input Purpose).
5. **The ledger is silent on accessibility.** It lists exports and spec clauses; an auditor cannot see which WCAG criteria have automated evidence on which route and which need a person.
6. **No response carries a security policy.** Only built assets carry `nosniff` (`packages/server/src/internal/servedEntry.ts:27`); no `Content-Security-Policy`, `Referrer-Policy`, frame or HSTS header exists. A strict policy is reachable: a served document has no inline script but `#k-state` (`application/json`), no inline style and no `on*` attribute (`documentHtml.ts`, `headHtml.ts`); the runtime's only HTML-string sink is `template()` (`packages/runtime-dom/src/ops/template.ts`: `t.innerHTML = html`, compiler output), which a Trusted Types policy would otherwise block; and Vite's preload helper in a client build reads `meta[property=csp-nonce]` (measured in golden-2's built `index-*.js`).
7. **Personal data has no declaration.** Only `s.secret` and per-module `redact` paths exist. Nothing says a field is personal across sinks: a `diag` log record holds an uncaught throw's message verbatim in production, a session keeps every input value but passwords and `el:` entries, and a route param can carry an email into browser history and proxy logs.
8. **Nothing gathers the evidence.** No command collects the ledger, accessibility results, the policy served, the personal-data inventory and the dependency list into one dated, signed artifact, and `stdCommand` reserves only `session` (`packages/cli/src/stdCommand.ts:10`), so a stdlib package cannot add one.

## Proposal

### 1. The model
Four claims, each backed by machinery that already runs in CI:

1. **Accessible.** Every route is checked statically (`keel check`) and at render (`keel test`, axe-core plus Keel's token contrast and input-purpose checks). Each (route, WCAG criterion) pair that a rule covers becomes a ledger item; the rest are listed for a person.
2. **Strict.** Every document a `node` deployable serves carries a nonce-based policy with `'strict-dynamic'`, Trusted Types and a report endpoint, and every response carries the same fixed header set. `keel check` reports source the policy would block.
3. **Private.** A schema marks a node personal with `.pii(class)`. Sessions, inputs, server logs and the evidence bundle redact by that mark, and a route may not put marked data in its URL.
4. **Evidenced.** `keel evidence` runs check, test and ledger, and writes a dated directory signed with Ed25519 that `keel evidence --verify` checks without the source.

### 2. Kernel changes
Four new kernel sections hold the changes; k.ui, k.schema, k.server, k.testing, k.head and k.cli each give up text or gain one pointer. No change to the text of k.store, k.ctx, k.reactive, k.runtime, k.compiler, k.router, k.forms, k.module, k.topology or k.services; the behavior K4 and K5 add to the runtime, forms and the ctx observer is specified in k.security and k.privacy, as k.sync specifies store, ctx and server behavior.

- **K1, k.a11y: required props, contrast and focus order** (moved from k.ui and extended). The required-prop sentence and E1802, E1804 move from k.ui. E1804 also checks text against the nearest ancestor `bg` in the same component and gives large bold text the 3:1 threshold; E1820 reports a reversed `direction` over two or more focusable elements. `Input`, `TextArea` and `Select` gain `autocomplete: Autofill`.
- **K2, k.a11y: render checks and claims.** The harness runs axe-core (tags `wcag2a` to `wcag22aa`) in place of its four rules, page rules on `renderRoute` only, a contrast check computed from atomic classes and tokens in place of axe's `color-contrast`, and E1821 for a personal control without `autocomplete`. `keel test` writes `reports/a11y.json`; `keel ledger` turns it into `a11y:<routeId>#<criterion>` items. Handles gain `focusOrder()`.
- **K3, k.head: focus after navigation.** A client navigation to another route focuses the page's first `h1` (`tabindex="-1"`), else `main`.
- **K4, k.security: headers and the policy** (new; the caller cookie sentence moves here from k.server). Six headers on every response, HSTS on https, the nonce policy on every document, `Report-Only` in dev, the `keel` Trusted Types policy in `template()`, `POST /__keel/csp`, E1570 and E1571, and `dist/<name>/csp.txt` for `client` and `static` deployables.
- **K5, k.privacy: personal data** (new; `s.secret` and E1105 move here from k.schema). `.pii(class)` over a closed `PiiClass`, `piiPaths` and `piiValues`, `data-k-pii` on bound controls with the observer mask, `diag` messages scrubbed, E1111 for marked data in a route's `params` or `search`.
- **K6, k.evidence and k.cli: the bundle.** `keel evidence` and `--verify`, seven files plus the signature, E1060 to E1064; k.cli gains the command row and the `csp` and `evidence` kinds.
- **K7, k.testing: pointers.** The render-check sentence defers to k.a11y, and the ledger names a third item kind.

Where the tokens come from (every count `ceil(length / 4)`, the `tooling/budgets.mjs` rule):

| section | before | after | what moves |
| --- | --- | --- | --- |
| k.ui | 1,498 | 1,421 | out: the "Required a11y props are in the type: ..." sentence and the E1802 and E1804 rule entries (to k.a11y); in: one pointer sentence. Its two a11y clauses stay, so no k.ui clause renumbers |
| k.schema | 1,498 | 1,272 | out: the **Secrets** paragraph, E1105 and the "For every generated secret" clause (to k.privacy, verbatim); in: one pointer clause |
| k.server | 1,499 (RFC 0081) | 1,458 | out: the cookie sentence "The cookie (`HttpOnly; SameSite=Lax; Path=/`) is ..." and the clause "On https the caller cookie is ..." (to k.security, verbatim); in: a Document pointer and two Log entries |
| k.testing | 1,485 | 1,459 | out: the role-and-name comparison sentence (to k.a11y Render checks); in: a pointer and the third ledger item kind |
| k.cli | 1,486 | 1,498 | in: the `evidence` row and two kinds; trim: the `keel inspect` summary lists no count names |
| k.head | 671 | 766 | in: the focus sentence and one clause |
| std.sessions | 1,498 (RFC 0081) | 1,498 | the Module paragraph's entry grammar rewritten (`redact` takes `el:` and `error:`; `expose` keeps `tx:`, `store:`, `route:`); E2001 gains the `.pii()` case |
| k.a11y | new | 1,281 | |
| k.security | new | 1,162 | |
| k.privacy | new | 1,001 | |
| k.evidence | new | 1,071 | |

### 3. Package contracts
One export per file, filename equals export; schemas first; effects through `ctx` (`random` for the nonce, `clock` for the report window and the bundle date). The CLI's Node edge (file writes, `node:crypto` signing, the `git` and `pnpm list` child processes) stays in `packages/cli/src/internal/`, where `keel build` already writes files. No new package; `tooling/deps.json` is unchanged.

| package | new or changed exports (file) | diagnostics |
| --- | --- | --- |
| `@keel/schema` | `.pii(class)` on every node; `PiiClass` (`PiiClass.ts`, an `s.enum` and its type); `piiPaths` (`piiPaths.ts`); `piiValues` (`piiValues.ts`) | none at runtime; the class is a type error outside the vocabulary |
| `@keel/ui` | `autocomplete` on `Input`, `TextArea`, `Select`; `Autofill` (`types/Autofill.ts`, a closed union of the WCAG 2.2 input purposes and `off`); `contrastTable` (`css/contrastTable.ts`) | E1802, E1804 (static), from `@keel/check` |
| `@keel/forms` | a bound control writes `data-k-pii="<class>"` when its path is marked (internal) | none |
| `@keel/runtime-dom` | `template()` uses the `keel` Trusted Types policy; the observer mask selector adds `[data-k-pii]` (`internal/SECRET_FIELDS.ts`) | none |
| `@keel/router` | focus after a navigation to another route (internal) | none |
| `@keel/testing` | `focusOrder()` on `render` and `renderRoute` handles; `A11yRun` (`a11y/A11yRun.ts`); `WcagCriterion` (`a11y/WcagCriterion.ts`); `criteriaOf` (`a11y/criteriaOf.ts`, axe tags and Keel codes to criteria); export `./a11y` | E1702, E1703 (axe-core), E1804 (render), E1821 |
| `@keel/check` | rules `contrastInherited` (extends `lowContrast.ts`), `reversedFocusOrder.ts`, `piiInUrl.ts`, `crossOriginUrl.ts`, `crossOriginFetch.ts` | E1804, E1820, E1111, E1570, E1571 |
| `@keel/server` | the headers, the nonce, `<meta property="csp-nonce">`, `POST /__keel/csp` and the `csp` record (internal); `cspPolicy` and `securityHeaders` (`csp/cspPolicy.ts`, `csp/securityHeaders.ts`, export `./csp`, read by the CLI for `csp.txt` and `security.json`); the `diag` scrub | W1557 (moved text) |
| `@keel/cli` | `evidence` operation; export `./evidence` with `Manifest`, `A11yReport`, `SecurityReport`, `PiiReport`, `DepsReport`, `EvidenceRecord` (one schema per file); ledger a11y items; `keel build` writes `csp.txt` | E1060 to E1064 |
| `@keel/std-sessions` | redaction by `piiPaths` and `piiValues`; `redact` subjects `el:` and `error:` only; `record` throws E2001 on any other | E2001 (extended) |

Diagnostics (message under 90 characters, fix when one exists):

| code | message | fix |
| --- | --- | --- |
| E1804 | `text recipes.count: textSecondary on surfaceLow is 4.36:1; needs 4.5:1` | none (a token choice) |
| E1820 | `row-reverse puts focus order against visual order` | `-direction="row-reverse"` / `+direction="row"` with the children reversed |
| E1821 | `signup.email is personal (contact); set autocomplete or "off"` | none (render code) |
| E1111 | `params.email is personal data (contact); a URL reaches proxy logs` | none |
| E1570 | `https://cdn.example/a.png is another origin; the CSP blocks it` | none |
| E1571 | `fetch of https://api.example from client code; the CSP blocks it` | none |
| E1060 | `bundle written with 2 check errors and 1 failed test` | none |
| E1061 | `KEEL_EVIDENCE_KEY is not an Ed25519 private key; nothing written` | none |
| E1062 | `deps.json changed since signing` | none |
| E1063 | `signature does not verify with key 3f2a9c01d2e4b5a6` | none |
| E1064 | `--audit file is not pnpm audit --json output` | none |
| E2001 | `tx:cart.pay is not a redact subject; mark the field .pii()` | removes the entry |

Codes taken: E1111 (k.schema's block E110x), E1570 and E1571 (k.server's block E155x, after RFC 0080's E1561 and E1562), E1820 and E1821 (k.ui's block E18xx), E1060 to E1064 (k.cli's block E105x). No stdlib block is taken. S5 (RFC 0082) must avoid these.

### 4. The accessibility pack
**Borrow axe-core.** The harness runs axe-core 4.14.0, already installed and already passing on base elements under happy-dom, with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` over the rendered root. A component `render` runs element rules; a `renderRoute` page also runs `document-title`, `html-has-lang`, `landmark-one-main`, `region` and `bypass`, page rules the ui conformance file disables for a bare element. An `incomplete` result (happy-dom has no layout) counts as not run, so it never supports a claim. axe-core moves from a devDependency of `@keel/ui` to a dependency of `@keel/testing` (MPL-2.0, used unmodified; test-time only, so no app bundle carries it).

**Build the contrast check.** happy-dom computes no colors, and every Keel color is a token on an atomic class (k.ui), so the harness reads each text element's `fg` and its nearest painted ancestor's `bg` from their classes and the project's tokens, per scheme and breakpoint, and applies the WCAG formula `contrast.ts` already implements. Statically, E1804 extends from "the element sets both" to "the element sets `fg` and an ancestor in the same component sets `bg`". The thresholds gain the bold rule (18.66px at weight 700 is large). Text under `states.disabled` is exempt (1.4.3 exempts inactive components), and a `states.hover` color is not a resting color.

**Focus.** No base element takes `tabindex` and the style vocabulary has no `order`, `position`, `z-index` or `outline` (`StyleValues.ts`), so sequential focus order is document order and no style removes the platform focus ring. The one way to break order is a reversed `direction`, which E1820 reports when two or more focusable base elements sit under it. `focusOrder()` lets a test assert the order. After a client navigation to another route the router focuses the first `h1` (adding `tabindex="-1"`), else `main`, so a screen reader starts at the new page; a search-only navigation keeps focus (K3).

**Input purpose.** `autocomplete: Autofill` on `Input`, `TextArea` and `Select`, a closed union of the HTML autofill field names WCAG 2.2 lists as input purposes plus `off`. A control bound to a `.pii()` field without it fails its render with E1821: personal data about the user needs its purpose, and `off` states that the data is not the user's own (an organizer typing a volunteer's name).

**Claims.** `keel test` writes each render check to `reports/a11y.json` (`A11yRun[]`). `keel ledger` reads it with `.keel/routes.json` and emits `a11y:<routeId>#<criterion>` at `example` when a passing `renderRoute` test rendered the route, every rule mapped to the criterion ran and none was violated, and `keel check` reports none of its static codes; else `none`. Only criteria that some rule maps to become items, so the ledger does not grow by every criterion of every route; the evidence bundle lists the others for a person. A claim is about the checks, never about the criterion as a whole: `a11y:shifts.show#1.1.1` at `example` says `image-alt` and the other rules mapped to 1.1.1 passed, not that the alt text is good. `keel ledger --diff` reports a lowered claim as E1706, so the ledger gate covers accessibility regressions.

**Brand.** `brandTokens` passes every pair the golden apps use, measured: `text` 16.60:1 and `accent` 5.22:1 on `surface`; `textSecondary` 4.59:1 on `surface`. It fails one pair no app uses today: `textSecondary` on `surfaceLow`, 4.36:1. The extended E1804 reports that pair wherever a component composes it. Q5 asks whether to darken `textSecondary`.

### 5. CSP and headers
**Why a nonce.** A `node` document is rendered per request, so a fresh nonce costs nothing, and with `'strict-dynamic'` the resume entry's imports (Vite chunks, and the locale chunks golden-2 loads) run without listing hosts. Google's strict-CSP guidance and the CSP Evaluator treat `script-src 'self'` as bypassable through any same-origin file that parses as script; a nonce removes the question. A hash-based policy needs an inline loader whose hash is listed, which Keel documents do not have, or matching of hashes against external scripts with `integrity`, which browsers implement unevenly. The nonce is two `ctx.random.id` values (two crypto-random v4 UUIDs on a real ctx, 244 random bits), so it is deterministic under a sim seed and testable.

**What the server writes.** `nonce` on the one `<script type="module">` and on `<meta property="csp-nonce">`, which Vite's preload helper reads to stamp the `<link>` elements it adds. `#k-state` is `application/json`, a data block the policy does not govern. Fonts are self-hosted (`/assets/*.woff2`, measured in golden-2's build), so `font-src 'self'` holds. `require-trusted-types-for 'script'` leaves the runtime exactly one way to make HTML from a string: the `keel` policy in `template()`, whose input is compiler output. Browsers without Trusted Types ignore the directive.

**One policy.** There is no `createApp({ csp })` option: no app can add `'unsafe-inline'`, a CDN or an analytics host (default 6). A need for another origin is a later RFC, and E1570 and E1571 report it at check time instead of in a browser console. Dev sends the same policy as `Report-Only` with `'unsafe-inline'` in `style-src`, because Vite's dev server injects `<style>` elements.

**Reports.** `POST /__keel/csp` is a kernel route like `/__keel/inspect`. It changes no state, so it skips the write proof (a browser's report request may carry no `Origin`); it is capped at 16 KiB per body and 100 logged reports per 60 s window, and it logs an origin and a route id, never the document URL, its query or a script sample (default 4). Reports go to the app's own log; no third party receives them (Q3).

**Other deployables.** A `client` or `static` document is served by a host Keel does not run, so Keel sends nothing for it. `keel build` writes `dist/<name>/csp.txt` with `script-src 'self'` (no nonce exists without a server), and the evidence bundle records it. A `<meta http-equiv>` policy was rejected for S6: it cannot carry `frame-ancestors` or reporting, and `apps/inspector`, a `client` app, fetches other origins' inspect documents, which `connect-src 'self'` would block (Q6).

**Headers.** `nosniff`, `Referrer-Policy: same-origin` (no path or query leaves for another origin), `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` beside `frame-ancestors 'none'` for older engines, a `Permissions-Policy` turning off camera, microphone, payment and USB (no Keel capability uses them; geolocation keeps its default for std-geo), and HSTS on https decided by the same rule as the `__Host-` cookie.

### 6. Personal data
**The mark.** `.pii(class)` on any schema node, in a `*.schema.ts` file. It changes no type and no derivation; it adds `pii` to the node, ` pii(<class>)` to `doc()` and `x-keel-pii` to JSON Schema. The class vocabulary is closed (principle 4) and sized for an inventory an auditor reads: `name`, `contact`, `location`, `identifier`, `financial`, `special` (GDPR article 9 data), `network`, `content`. Every class is redacted alike; the class says what kind of data a sink would have held.

**Sinks** (default 4). Sessions: std.sessions replaces marked values with generated ones at capture, so a session still parses and replays, and drops them from error text. Inputs: a control bound to a marked path carries `data-k-pii`, and the runtime masks its `input` values before any observer sees them, as it does for password fields. Server log: a `diag` message is scrubbed of `piiValues` of the request's input, loader outputs and factory store states, computed only when a `diag` is written. URLs: E1111 refuses marked data in `params` and `search`, since Keel cannot redact a proxy's log or a browser's history. Evidence bundle: holds no app value. Dev inspect stays unredacted: it is the developer's own data in dev.

**One way** (default 2). `redact` entries keep `el:` (an element whose values have no schema) and `error:` (error `data`, which has no schema). `tx:`, `store:` and `route:` stay `expose` subjects only, for `to-test`. A `tx:`, `store:` or `route:` `redact` entry is E2001 in `keel check`, and `record` throws on it, so an app upgraded without editing its config fails closed instead of recording the value. An `expose` entry under a marked path is E2001: personal data cannot be exposed to a test file.

**Coverage.** `keel evidence` imports each `*.schema.ts` and lists every marked path with its class. Each path is counted against four sinks, and each sink has one conformance clause that proves its redaction for generated schemas and values: `std.sessions#2` (sessions), `k.privacy#7` (inputs), `k.privacy#6` (log), `k.evidence#5` (bundle). A (path, sink) pair is covered when that clause's ledger rung is `probabilistic` or higher, so all four are written as 100-run properties (std.sessions#2 is `example` today and gains one). Coverage is by construction for declared paths; the independent check is golden-3's canary test (Proposal 9), which puts generated values into every marked field and searches every sink's output for them. A value copied into an unmarked field is not declared and not counted, the same limit THREAT-MODEL states for a revealed secret.

### 7. The evidence bundle
`keel evidence` runs the k.cli `check`, `test` and `ledger` operations in process, so the bundle and CI agree, and writes `evidence/<date>/`: `manifest.json`, `manifest.sig`, `check.ndjson`, `ledger.ndjson`, `a11y.json`, `security.json`, `pii.json`, `deps.json`. It makes no network request: dependency advisories come from a `pnpm audit --json` file CI writes and passes with `--audit` (Q3). The signature is Ed25519 over the manifest's bytes (deterministic per RFC 8032, so a sim run is byte-equal); the key comes only from `KEEL_EVIDENCE_KEY`, and the manifest carries the public key and its 16-hex `keyId`. A verifier pins the `keyId` the project publishes out of band with `--verify <dir> --key <keyId>`. Failing runs still produce a bundle that records them, and the command exits 1 (E1060): an auditor sees the state as it is.

### 8. What S6 needs from `@keel/testing` (RFC 0082 coordination)
S5 owns the harness design. S6 changes only the rule engine at the existing render-check point and adds `focusOrder()`. It needs:

- **R1.** `renderRoute` renders the route's document context: `<html lang>` and `<title>` per k.head and the chain inside `<main>`, as the server's document does, so axe-core's document rules have a document to judge.
- **R2.** One render-check point (after the first render, after each `fire`, on `settle()`) stays in `@keel/testing`; any simulator or model checker that renders reaches it, so its renders count for claims.
- **R3.** Harness renders stay on happy-dom, where axe-core 4.14.0 is measured to run.
- **R4.** `keel test` lets a harness write a report file under `reports/` per run, as Stryker writes `reports/mutation/`.
- **R5.** RFC 0082's k.testing edits leave the **a11y** paragraph's first sentence and the Ledger paragraph's first sentence in place, or carry K7's two edits; K7 is 26 tokens net negative, so it gives S5 room rather than taking it.

### 9. Exit proof and golden app 3
**What it is.** `apps/golden-3`, a volunteer shift sign-up for a food bank, built by an agent from the public docs: anyone signs up for a shift with their name, email, phone and access needs, sees and cancels their own sign-ups, and an organizer sees the roster with contact details and marks attendance. It is the first golden app whose user-facing pages a `node` deployable renders (golden-1 and golden-2 show theirs from `client` deployables), so the nonce policy applies to every page, and it holds personal data in every sink.

**Modules** (one `node` deployable `web`, `brandTokens`, `en-US`):
- `shifts`: store factory `shifts.board` (`Board { shifts: Shift[], signups: Signup[] }`); `Signup { id, shiftId, name: line.pii('name'), email: Email.pii('contact'), phone: tel.pii('contact').optional(), needs: para.pii('special').optional(), owner: s.string().pii('identifier') }`, `owner` the caller hash; routes `shifts.index` `/`, `shifts.show` `/shifts/:shiftId` (a Form with `autocomplete` `name`, `email`, `tel`; `needs` `off`), `shifts.mine` `/mine` with a cancel Button per sign-up; actions `signUp` and `cancel` (only the owner's caller; another's id is `keel.notFound`).
- `roster`: `/roster`, guard `organizer` (the caller hash is in the module's server-only `organizers` config, else redirect to `/`); per shift the sign-ups with contact details and an `attended` Checkbox.
- `sessions`: std.sessions' `routes`, `readers` the organizers; the shell records with `upload` to `/sessions`.

**Docs that must exist before the build** (the eval's agent reads only these and the spec): k.a11y, k.security, k.privacy and k.evidence at `conformance-covered`; skill lines (`keel`: mark personal fields with `.pii(class)`, never in `params` or `search`, `autocomplete` on personal inputs; `keel-api`: pages of a `node` deployable carry the policy, no other origins, a guard over a server-only caller list; `keel-forms`: `autocomplete`, `data-k-pii`; `keel-testing`: a `renderRoute` test per route makes the claims, `focusOrder()`, a canary test with `piiValues`, the log `write` and the sim `session` capability's `taken()`); READMEs of `@keel/schema`, `@keel/server`, `@keel/testing`, `@keel/cli` and `@keel/std-sessions`; and `docs/COMPLIANCE.md`, one page for app authors and auditors: what Keel enforces for WCAG 2.2 AA, the policy and personal data, what the app declares, how to make and verify a bundle, and what is left to a person. `evals/tasks/golden-3/TASK.md` pins ids, routes, copy and the data model, and names those docs for every API instead of restating it.

**The eval** (`pnpm eval --task golden-3 --runner none --strict` on the built app; `--runner claude` for the agent build). `pass.ts` requires:
1. The app's `check` script, `keel check` and its tests green; unsafe count 0; every export at `example` or better; the ledger not regressed.
2. A11y pack green: every `a11y:<routeId>#<criterion>` item of the app at `example`; the hidden `acceptance.test.ts` renders each route with no E1703, E1804 or E1821, asserts `focusOrder()` on the sign-up form and focus on the `h1` after navigating from `/` to a shift.
3. CSP strict: every document response carries the k.security policy byte for byte with a fresh nonce, and every response the six headers; a Playwright journey (`evals/tasks/golden-3/browser.ts`: sign up, list mine, cancel, organizer roster) on Chromium and WebKit, the engines installed in the Playwright cache, records no `securitypolicyviolation` event and the app log no `csp` record; a second context with `bypassCSP` runs axe-core with `color-contrast` on each page and finds no violation.
4. Redaction coverage 100 % of declared PII: `pii.json` coverage is 1; the canary run fills every marked path with generated values of at least 8 characters, then finds none of them in the log lines (`createApp({ log: { write } })`), the uploaded and ingested sessions, the files under `.keel/sessions/`, a `to-test` file of an injected failure, or the bundle; a marked path the run never filled fails the gate.
5. The bundle verifies: `keel evidence` with a key `pass.ts` generates in its temp dir, then `keel evidence --verify <dir> --key <keyId>` exits 0; `deps.json` has `advisories` from a recorded `pnpm audit --json` fixture.

**What the auditor and the pen tester receive.** The verified bundle and its `keyId`; a deployment of golden-3 built from `deploy/web/Dockerfile` on https; two browser profiles, a volunteer and an organizer (the organizer's caller hash added to `organizers`); the scope: the accessibility audit covers the four pages against WCAG 2.2 AA with a desktop and a mobile screen reader, starting from `a11y.json`'s list of criteria no rule checks; the pen test covers access control (`/roster`, `cancel` on another's sign-up), CSRF (the write proof), XSS (escaping, the policy, Trusted Types), headers and the cookie, personal data in logs, sessions and `/sessions/list`, and the documented caps (body, report window, ingest buffer). `docs/THREAT-MODEL.md` goes with it, so known residual risks are not reported as findings.

**How findings come back.** The orchestrator turns each finding into one backlog line, `audit (<firm>, <date>), <severity>: <finding> (<WCAG criterion or CWE>) · <packages> · <sections> · S6 · 0312`. A kernel finding goes through an RFC; an app finding is fixed in golden-3 and its eval reruns. A finding against a criterion the ledger held at `example` also adds the missing rule or test, so the claim and the machinery agree again. The stage exits when the re-test report has no open Level A or AA failure and the pen test no high or critical finding.

## Alternatives
- **Keep the harness's own rules and add more.** Four rules cover a fraction of axe-core's WCAG-tagged set; writing the rest is a second accessibility engine to maintain. axe-core already runs on happy-dom here.
- **Real browsers for every render check** (Playwright in `keel test`). Gives axe's own `color-contrast`, but turns a sub-second harness into a browser farm and breaks sim determinism. The eval's browser journey covers real engines once per stage; tokens make contrast computable without layout.
- **A `wcag` claim per criterion without routes.** Hides where a failure is; an auditor tests pages.
- **`script-src 'self'`.** Simpler and cacheable, but bypassable by any same-origin file that parses as script, and flagged by the CSP Evaluator; nonces cost nothing on a per-request document.
- **Hash-based CSP for `node` documents.** Needs an inline bootstrap whose hash is listed, which Keel documents do not have and do not want.
- **A `createApp({ csp })` option.** Every option is a way to widen the policy; one fixed policy keeps the claim checkable (defaults 2 and 6).
- **A meta policy in `client` builds.** No `frame-ancestors` or reporting, and it breaks `apps/inspector`; `csp.txt` lets the host send the header.
- **A third-party report collector** (report-uri.com, Sentry). Sends document URLs to an outside party; the app's own log keeps them redacted.
- **`s.pii(inner, class)` as a wrapper type like `Secret<T>`.** Every read of an email would need an unwrap, while personal data is meant to flow through the app; the mark belongs on the schema, not the value.
- **Free-form PII labels.** An auditor's inventory needs a fixed set (principle 4); eight classes cover what golden-3 and the existing apps hold, and `special` groups GDPR article 9 data.
- **Keeping `tx:`, `store:` and `route:` `redact` subjects beside `.pii()`.** Two ways to mark one value (default 2), and the config form misses the log and input sinks.
- **Redacting every unmarked value in logs** (default 4 read literally). Logs carry route ids, codes and statuses; the only values they held were thrown messages, which the scrub now covers, and paths, which E1111 keeps free of marked data. A 404's path is logged as requested (Known limits).
- **A `@keel/std-evidence` package.** `stdCommand` reserves only `session`; widening it is a k.cli change anyway, and the bundle needs kernel operations (check, test, ledger) in process.
- **Sigstore or cosign signing.** Ties the bundle to an outside transparency log and an OIDC identity (an external integration); Ed25519 with a project key verifies offline (Q3).
- **Running `pnpm audit` inside `keel evidence`.** A network call to the npm registry from a command CI may run offline; the file input keeps the command offline and the advisories dated.

## Spec diff
Token counts are `ceil(length / 4)`, measured by applying these edits to copies of the sections at commit `c449c0c` (k.server and std.sessions with RFC 0080's and RFC 0081's edits applied). Moved text is verbatim.

### spec/kernel/k.a11y.md (new, 1,281)
~~~md
# k.a11y: Accessibility
status: proposed

**Target.** WCAG 2.2 Level A and AA. Each criterion is checked statically (`keel check`), at render (`keel test`), or by a person; the ledger and the evidence bundle (k.evidence) say which.

**Required props.** In the `@keel/ui` types (E1802): `Heading level`; `Image alt` or `decorative`; `label` on `Input`, `TextArea`, `Select`, `Checkbox`; `Link to: Href` with text; `Button` children (text, or an `Image` whose `alt` names it; no `label`). `Input`, `TextArea` and `Select` take `autocomplete: Autofill`, written as the attribute: an HTML autofill field name from the WCAG 2.2 input purposes (`name`, `email`, `tel`, `street-address`, `bday`, ...) or `off`.

**Contrast.** Text needs 4.5:1 against its background, 3:1 when large (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700), per color scheme and breakpoint; text inside `states.disabled` is exempt, and text without a `fontSize` token is normal size. Statically (E1804), the background is the element's `bg`, else its nearest ancestor's `bg` in the same component; with neither, the element is checked at render. At render, colors and sizes come from each element's atomic classes and their tokens (no layout): the background is the nearest painted ancestor's `bg`, else `#FFFFFF`. `contrastTable(tokens)` (`@keel/ui`) lists every ordered pair of color tokens per scheme with its ratio.

**Order and focus.** No base element takes `tabindex`, and the style vocabulary has no `order`, `position`, `z-index` or `outline`, so sequential focus order is document order and the platform's focus indicator stays. `direction` `row-reverse` or `column-reverse` on an element with two or more focusable base elements under it in its component is E1820. Harness handles have `focusOrder()`: the ids of focusable elements in sequential order, skipping disabled and hidden ones. Focus after a client navigation: k.head.

**Render checks** (`@keel/testing`). After the first render, after every `fire` and on `settle()`, the harness compares each element's role and name source with the compiler's `a11y.json` (E1702; passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, not checked), then runs axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` over the rendered root (E1703). A `render` of a component runs element rules only; a `renderRoute` page also runs the document rules (`document-title`, `html-has-lang`, `landmark-one-main`, `region`, `bypass`). axe-core's `color-contrast` is replaced by the render contrast check (E1804), and a control with `data-k-pii` (k.privacy) and no `autocomplete` is E1821. An axe result of `incomplete` counts as not run.

**Claims.** `keel test` writes every render check to `reports/a11y.json` (`A11yRun[]`: route or component, rules run, violations). For each route in `routes.json` and each criterion a rule maps to, `keel ledger` emits `{ kind: 'ledger', item: 'a11y:<routeId>#<criterion>', rung, evidence }`: `example` when a passing `renderRoute` test rendered the route, every rule mapped to the criterion ran, none was violated and `keel check` reports none of its static codes; else `none`. The map is axe-core's `wcag` rule tags plus: E1702 4.1.2 · E1802 1.1.1, 1.3.1, 2.4.4, 4.1.2 · E1804 1.4.3 · E1820 1.3.2, 2.4.3 · E1821 1.3.5. Criteria no rule maps to are for a person; the evidence bundle lists them.

**Rules.** E1802 missing a11y-required prop · E1804 text below its contrast threshold (static and render) · E1820 reversed `direction` over focusable elements (fix: reverse the children, plain direction) · E1821 a control bound to a `.pii()` field without `autocomplete` (render).

**Conformance.**
- A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804; at `fontSize` 18.66px and `weight` 700, or under `states.disabled`, it is not.
- A `renderRoute` page whose text is 4.4:1 against a `bg` set in another component fails with E1804 naming the text's element id; at 4.6:1 it passes.
- A `render` of a component reports no document rule; a `renderRoute` of a titled route reports no `document-title` or `html-has-lang` violation.
- An unlabeled `input` made with the runtime's `element` fails its render with E1703 naming rule `label` and the element id.
- A `Box` with `direction="row-reverse"` over two `Button`s is E1820 and its fix leaves `direction="row"` with the children reversed; over one `Button` it is clean.
- An `Input` bound to a `.pii('contact')` field without `autocomplete` fails its render with E1821; with `autocomplete="email"` or `"off"` it passes and the attribute is in the markup.
- `focusOrder()` lists focusable element ids in document order without disabled or hidden ones.
- After `keel test` with one passing `renderRoute` test of route `r`, `keel ledger` gives `a11y:r#1.4.3` rung `example` and `a11y:r2#1.4.3` rung `none` for an untested route `r2`; a violation of a rule mapped to 1.4.3 on `r` makes it `none`.
- `contrastTable(tokens)` has one entry per ordered pair of distinct color tokens per scheme, each ratio WCAG's to two decimals.
~~~

### spec/kernel/k.security.md (new, 1,162)
~~~md
# k.security: Response headers, CSP and the caller cookie
status: proposed

**Headers.** Every `createApp` response (documents, JSON, event streams, assets, redirects, errors) carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and `Permissions-Policy: camera=(), microphone=(), payment=(), usb=()`; on https (the cookie's rule below) also `Strict-Transport-Security: max-age=63072000`.

**Policy.** Every document carries `Content-Security-Policy` (`Content-Security-Policy-Report-Only` in dev) with `Reporting-Endpoints: keel-csp="/__keel/csp"`:
```
default-src 'none'; script-src 'nonce-<n>' 'strict-dynamic'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none';
object-src 'none'; require-trusted-types-for 'script'; trusted-types keel; report-uri /__keel/csp; report-to keel-csp
```
`<n>` is new per response: two `ctx.random.id('Nonce')` values without hyphens. The document writes `nonce="<n>"` on its module script and `<meta property="csp-nonce" nonce="<n>">` in the head, which Vite's preload helper copies to the links it adds; `#k-state` is `application/json` and runs nothing. Dev adds `'unsafe-inline'` to `style-src` for Vite's injected styles. Other responses carry `default-src 'none'; frame-ancestors 'none'`. The policy has no option, so no app widens it.

**Trusted Types.** Where `globalThis.trustedTypes` exists, the runtime's `template()` builds its compiler HTML through the policy `keel`, created once per realm; a string assigned to any other HTML sink throws.

**Reports.** `POST /__keel/csp` takes `application/csp-report` and `application/reports+json` bodies up to 16 KiB (else 413, nothing logged) without the write proof, since it changes no state, and answers 204. Each report is one `csp` log record `{ kind: 'csp', directive, blocked, route }`: `blocked` is `inline`, `eval`, `trusted-types` or the blocked URL's origin; `route` is the route id the document URL matches, else `-`. No path, query or sample is logged. Past 100 reports in 60 s of `ctx.clock` the rest are counted, and the window's end writes one `csp` record `{ kind, dropped }`.

**Caller cookie.** The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, `Secure` on https (`createApp({ secure })`; default the URL's or `x-forwarded-proto`, W1557 in production), else `keel-caller`.

**Other deployables.** `client` and `static` documents are served by their host. `keel build` writes their policy to `dist/<name>/csp.txt`: the one above with `script-src 'self'`, no nonce and no report directives.

**Rules.** E1570 a literal absolute `http(s)` URL in `src`, `poster`, `data`, `srcset`, `action`, `formaction` or `Image src`: the policy blocks another origin (fix: none) · E1571 a literal absolute `http(s)` URL given to `ctx.net.fetch` or `service({ base })` in client-reachable code (E1004's reachability).

**Conformance.**
- Every `createApp` response, a 404, a 413 and an asset included, carries the six headers; `Strict-Transport-Security` only on https.
- A production document carries the policy above, and its nonce equals the `nonce` of its module script and of `<meta property="csp-nonce">`; two documents under one sim ctx carry different 64-character nonces.
- A dev document carries `Content-Security-Policy-Report-Only` with `'unsafe-inline'` in `style-src` and nowhere else; JSON and event-stream responses carry `default-src 'none'; frame-ancestors 'none'`.
- No document of the fixture app has an inline script other than `#k-state`, a `<style>`, a `style` attribute or an `on*` attribute.
- A `csp-report` POST answers 204 and logs one `csp` record whose `blocked` is the blocked URL's origin and `route` the document's route id; no record holds the document's path or query.
- The 101st report within 60 s of the sim clock is not logged; one `csp` record with `dropped: 1` follows the window; a 17 KiB body is 413 and logs nothing.
- With a stub `trustedTypes` global, `template()` passes its HTML through policy `keel`, created once.
- On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none.
- `Image src="https://cdn.example/a.png"` and `action="https://x.example/"` are each E1570; `src="logo.png"` is not.
- `ctx.net.fetch(new Request('https://api.example/x'))` in a client-reachable file is E1571; in a `*.server.ts` file it is not.
- `keel build` of a fixture with a `client` deployable writes its `csp.txt` with `script-src 'self'`.
~~~

### spec/kernel/k.privacy.md (new, 1,001)
~~~md
# k.privacy: Secrets and personal data
status: proposed

**Purpose.** Two schema marks decide what may leave the process. A secret never serializes. Personal data serializes where the app sends it (its stores, its own user's page) and is redacted in every sink: sessions, logs, error text and the evidence bundle.

**Secrets.** `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. `decodeStrings` reads the inner type. `gen` wraps a generated inner value; `doc()` is `secret<T>`.

**Personal data.** `schema.pii(class)` marks any schema node as personal data, in a `*.schema.ts` file. `PiiClass` is closed: `name` · `contact` (email, phone, handle) · `location` (address, coordinates) · `identifier` (government, account and customer numbers, birth dates) · `financial` · `special` (health, biometric, belief, ethnicity, orientation) · `network` (IP address, device id) · `content` (text a person wrote). The mark keeps the type and every derivation (`parse`, `encode`, `decodeStrings`, `gen`); the node gains `pii: class`, which covers every value under it; `doc()` appends ` pii(<class>)` and JSON Schema adds `x-keel-pii`. From `@keel/schema`, both pure: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order (array items `*`); `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and each number (as `String()`) under a marked path.

**Sinks.**
- Sessions (std.sessions): marked values in payloads, state and error `data` become generated values at capture; error messages drop each.
- Inputs: a control bound (k.forms `field`) to a marked path carries `data-k-pii="<class>"`, and the ctx observer reports its `input` values as `x` repeated, as for a password field.
- Server log (k.server): before a `diag` record is written, each of `piiValues` of the request's decoded action input, its loaders' outputs and its factories' store states is replaced by `[pii]` in the message.
- URLs: a marked node in a route's `params` or `search` schema is E1111, since a path or query reaches browser history and proxy logs Keel cannot redact.
- Evidence bundle (k.evidence): holds no app value.
In dev, `/__keel/inspect` serves store values unredacted to the developer; it is not a sink.

**Rules.** E1105 `reveal` imported in an app file other than `*.server.ts` · E1111 a `.pii()` node in a route `params` or `search` schema (fix: none).

**Conformance.**
- For every generated secret: it parses; `encode`, `String` and `util.inspect` give the marker, `JSON.stringify` the marker's JSON, `structuredClone` an empty object; parsing a raw value yields a secret revealing it; the marker fails with rule `secret-missing`.
- For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives.
- `piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object.
- For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths.
- `s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: "contact"`.
- An action throwing an `Error` whose message holds a marked input value logs a `diag` record holding `[pii]` and not the value, in dev and production.
- Under a sim ctx, an `input` fired on an `Input` bound to a marked field reaches `observe` as `x` repeated, and the element has `data-k-pii`.
- A marked field in a route's `params` or `search` schema is E1111; in an action `input` it is not.
~~~

### spec/kernel/k.evidence.md (new, 1,071)
~~~md
# k.evidence: Evidence bundle
status: proposed

**Purpose.** One dated, signed directory that an auditor checks without the source: the ledger, the accessibility results, the headers and policy served, where personal data is and how each sink redacts it, and the dependencies.

**Command.** `keel evidence [--out <dir>] [--audit <file>]` runs `check`, `test` and `ledger` on the project (the k.cli operations), reads `topology.ts`, imports each module's `*.schema.ts` files once in Node as the build evaluates `routes.ts` (k.compiler), and writes `<dir>` (default `evidence/<date>`, the UTC date of `ctx.clock.now()`):

| file | holds |
| --- | --- |
| `manifest.json` | `{ v: 1, app, at, source, keel, key, keyId, runs, files }`: `source` `{ commit, dirty }` from git, else `null`; `keel` each `@keel/*` version; `runs` the check error and failed test counts; `files` `{ path, sha256, bytes }` per other file |
| `manifest.sig` | the Ed25519 signature of `manifest.json`'s bytes, base64 |
| `check.ndjson`, `ledger.ndjson` | the records of those runs; the ledger holds the a11y claims (k.a11y) |
| `a11y.json` | per route and criterion its rung and rules; the criteria no rule maps to, for a person; `contrastTable(tokens)` |
| `security.json` | per `node` deployable the headers and policy k.security sends, with `<nonce>`; per `client` or `static` one its `csp.txt` |
| `pii.json` | per `.pii()` path (file, export, path, class), each sink (k.privacy) and the rung of its clause (sessions `std.sessions#2`, inputs `k.privacy#7`, log `k.privacy#6`, bundle `k.evidence#5`); `coverage`, the share of (path, sink) pairs at `probabilistic` or higher |
| `deps.json` | each production dependency from `pnpm list --prod --json --depth Infinity` as a CycloneDX 1.5 component (name, version, integrity, license); `advisories` from `--audit` (`pnpm audit --json` output), else `null` |

Every file parses with a schema `@keel/cli/evidence` exports. No file holds an app value: records carry ids, codes, paths, counts and hashes. The command makes no network request.

**Signing.** The key is `KEEL_EVIDENCE_KEY`, an Ed25519 private key as PKCS#8 PEM, read only from the environment. `key` is its raw public key in base64, `keyId` the first 16 hex characters of that key's SHA-256. The bundle is written whether runs fail or not; failing runs exit 1 with E1060.

**Verify.** `keel evidence --verify <dir> [--key <keyId>]` re-hashes every listed file, finds no unlisted file, checks the signature with `key` (and that `keyId` equals `--key`), and parses each file with its schema. It emits one `evidence` record `{ kind, dir, at, keyId, files }`; compact `ok evidence evidence/2026-11-10 6 files key 3f2a9c01d2e4b5a6`.

**Rules.** E1060 the bundle records a check error or a failed test · E1061 `KEEL_EVIDENCE_KEY` absent or not Ed25519; nothing is written · E1062 a listed file missing or changed, or an unlisted file present (names it) · E1063 signature invalid, or `keyId` differs from `--key` · E1064 `--audit` file is not `pnpm audit --json` output.

**Conformance.**
- On a fixture project with `KEEL_EVIDENCE_KEY` set, `keel evidence` writes exactly the eight files above, and `--verify` of the result emits one `evidence` record and exits 0.
- Changing a byte of any bundle file, adding a file or removing one makes `--verify` report E1062 naming it; a manifest signed by another key, or a `--key` naming another keyId, is E1063.
- Without `KEEL_EVIDENCE_KEY`, or with an RSA key, the command writes nothing and reports E1061.
- Under one sim seed and clock, two runs on an unchanged project write byte-equal bundles.
- No bundle file of a fixture whose stores and tests hold generated `.pii()` values contains any of them.
- `pii.json` lists every `.pii()` path of the fixture's schema exports with its class; `coverage` is 1 when every sink clause is `probabilistic` or higher, and drops when one is lower.
- `security.json` holds the k.security policy with `<nonce>` for each `node` deployable and the `csp.txt` text for each `client` one.
- A fixture with a failing test still gets a verifying bundle whose `runs` counts it; the command exits 1 with E1060.
- An `--audit` file that is not `pnpm audit --json` output is E1064; without `--audit`, `deps.json` has `advisories: null`.
~~~

### k.ui (1,498 to 1,421)
- Base elements: "Required a11y props are in the type: `Heading level`; ... no `label`)." becomes "Required a11y props, `autocomplete` and contrast: k.a11y." (the sentence moves to k.a11y Required props).
- Rules: "E1802 missing a11y-required prop · " and "E1804 an element setting `fg` and `bg` below 4.5:1 contrast (3:1 at `fontSize` >= 24px), checked per color scheme · " move to k.a11y; the line ends "E1802 and E1804: k.a11y."
- Conformance: unchanged, so no k.ui clause renumbers.

Full text after the change:
~~~md
# k.ui: Tokens and styling
status: conformance-covered

**Tokens.** `tokens.ts` at the project root, validated by `TokenSchema` from `@keel/ui`:
```ts
export const tokens = defineTokens({
  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },
  space: { 1: '4px', 2: '8px', 3: '16px' },
  fontSize: { sm: '14px', md: '16px', lg: '24px' },
  breakpoint: { md: '768px' }, motion: { fast: '120ms' },
})
```
Groups are closed: `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border` (shorthands such as `1px solid var(--k-color-divider)`), `breakpoint`, `motion`. A color is a value or `{ light, dark }`, chosen by `prefers-color-scheme`. Motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `TextArea`, `Select`, `Checkbox`. Required a11y props, `autocomplete` and contrast: k.a11y. `Image src` is an asset URL string, not an `Href`. Every base element takes `lang`, a string written as its `lang` attribute. `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). Event props are a closed set: `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs. A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input), so server HTML shows it. Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written. A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime). An eager `Node` child is made first, so its island re-renders (E1253; check E1808).

**Style props** are the only styling: no `class` prop, no `styles()`. Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap`. Types accept any string shaped like a token name (`TokenName`: an identifier or short numeric key, so `16px` and `#fff` are type errors); whether the token exists is E1801. Responsive values are keyed by breakpoint. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object, so `disabled` stays the boolean attribute.
```tsx
<Box as="section" p={{ base: '2', md: '3' }} bg="bg" states={{ hover: { bg: 'accent' } }}>
  <Heading level={2}>Orders</Heading>
</Box>
```
The compiler emits one atomic class per (prop, token, breakpoint, state), deduplicated across the app, into one CSS file. Dynamic values switch classes; no inline style is generated.

**Standard slots.** JSX children are the default slot and arrive as `props.children` (k.component); base elements accept a thunk or a plain string/Node. `loading: () => JSX`, `empty: () => JSX`, `error: (e: KeelError) => JSX`. These names carry these signatures everywhere; `For` accepts `empty`.

**Rules.** E1801 raw value where a token is required (fix: nearest token) · E1803 `style` attribute · E1805 lowercase intrinsic element in app code (fix: matching base element) · E1806 standard slot name with another signature · E1807 `tokens.ts` fails `TokenSchema` · E1808 base element `children` made eagerly (an element call or JSX, or an array or `const` of them) (fix: `() =>`). E1802 and E1804: k.a11y.

**Conformance.**
- Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once.
- `p={{ base: '2', md: '3' }}` yields the `2` rule unconditioned and the `3` rule inside `@media (min-width: 768px)`.
- Under `prefers-reduced-motion: reduce` every motion token resolves to `0ms`.
- Every base element rendered with only its required props has no axe violations.
- A signal bound to a style prop changes only the element's class list; no element ever has a `style` attribute.
- `fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it.
- `Image src` accepts a string such as `'logo.png'` (no `Href` required); a `javascript:` value renders as `about:blank`.
- `fire(id, 'click')` on a Button with `onClick` calls the handler once; `fire(id, 'change')` on a Checkbox with `onChange` passes the new checked state.
- An `Input`, `TextArea`, `Select` or `Checkbox` given a signal for `value` or `checked` shows its first value in the markup; a later signal write changes only the property.
- `@keel/ui` exports no `styles`; no base element takes `class`; `Button` has no `label`, its children are its text.
- An `Input` bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default.
- A route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry, and resume adopts its server nodes without E1253 when children are thunks; a route of base elements with no event prop, `field` or signal has no `data-k`.
- A base element given `lang="ja-JP"` has `lang="ja-JP"` in server and client output; without it, none.
~~~

### k.schema (1,498 to 1,272)
- The **Secrets** paragraph moves to k.privacy verbatim; "Modifiers: ... are distinct." gains "`s.secret` and `.pii(class)`: k.privacy."
- Rules: "E1105 `reveal` imported in an app file other than `*.server.ts`" moves to k.privacy.
- Conformance: "For every generated secret: ..." moves to k.privacy as its first clause; k.schema clauses 10 to 12 become 9 to 11.

Full text after the change:
~~~md
# k.schema: Schemas
status: conformance-covered

**Purpose.** One declaration per data shape. Everything derives from it.

**API.**
```ts
import { s } from '@keel/schema'
export const User = s.object({ id: s.id('User'), name: s.string({ min: 1 }), role: s.enum(['admin','member']), email: s.string().optional() })
type User = s.infer<typeof User>
```
Primitives: `string`, `number` (finite, `{ min, max }`), `int` (`{ min, max }`), `boolean`, `literal`, `enum` (`{ pathDefault }`: the value a leading path param leaves out of the URL, k.prefix), `id(brand)`, `object` (`{ closed: true }`), `array`, `union(key, variants)` (discriminated) or `union(members)`, `record`, `json` (any `JsonValue`; non-JSON values fail with rule `type`). Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. `s.secret` and `.pii(class)`: k.privacy. Registry: `s.register(name, type)` for stdlib types.

**Format types.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false) and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; false fails with rule `format` at that path. `encode` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `decodeStrings` coerces as `base` does and then parses the format, so a value `check` refuses is a `format` issue; `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name.

**Derivations.** `User.parse(x): Result<User, SchemaError>` validates any input, also the JSON `User.encode(v)` gives (no `decode`) · `gen(User)` fast-check arbitrary (`import { gen } from '@keel/schema/gen'`; fast-check is a peer dependency, absent from app bundles) · `User.doc()`.

`decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)` (object schemas) coerces string input: numbers from numeric strings; booleans from `true|on|1` / `false|off|0`, absent boolean is false; empty string for an optional key is absent; arrays from repeated keys or `key[]`; nested objects by dotted keys; records from the remaining prefixed keys; literal/enum compared as strings. `parse` rejects own `__proto__`, `constructor`, `prototype` keys; `pathToString(path)` gives `users.0.name`.

**Closed objects and member unions.** `s.object(shape, { closed: true })` fails each own undeclared key with rule `unknown-key` at that key's path (open objects ignore them; `encode` drops them); `doc()` writes it `{| a: T |}`; JSON Schema derivations add `additionalProperties: false`; `decodeStrings` reads declared keys only. `s.union([a, b, ...])` (two or more members, no discriminant) accepts a value when the first member that accepts it does; when none does, the issues are the last member's. `encode` uses the first accepting member, `decodeStrings` the first member whose candidate parses; `gen` picks a member by seed; `doc()` is `a | b`; JSON Schema is `anyOf`. Members that are all tagged objects use `union(key, variants)`.

**SchemaError** is the KeelError `schema.invalid` (k.errors): a plain value `{ code: 'schema.invalid', message, data: { issues: { path: (string | number)[], rule: Rule }[] } }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant` · `unknown-key` (an undeclared key of a closed object) · `secret-missing` (the marker where a secret is required) · `format` (a format type's `check` refused the value). Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

**Rules** (checker, on source; never runtime codes). E1104 schema declared outside a `*.schema.ts` file · E1106 `s.format` in app code (format types are stdlib's).

**Conformance.**
- `parse(encode(v))` round-trips for every type but `secret`.
- A schema has no `decode`.
- Generator produces only valid values.
- Parse rejects every invalid shape in the fixture set.
- Branded IDs are not assignable across brands.
- For every generated valid value of an object schema of primitives, encoding to URLSearchParams then decodeStrings returns an equal value.
- For number and int with bounds, every generated value is within bounds and parse rejects values outside with rule min or max.
- Every generated json value round-trips and non-JSON values are rejected with rule type.
- Every generated value of a closed object round-trips, and adding an undeclared key fails with rule `unknown-key` at that key.
- Every generated value of a member union round-trips; a value no member accepts fails with the last member's issues.
- For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106.
~~~

### k.server (1,499 after RFC 0081, to 1,458)
- Server state: "The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, ... else `keel-caller`." moves to k.security (Caller cookie); the `caller` sentence stays.
- Document: appends "Headers, the policy, the caller cookie and `/__keel/csp`: k.security."
- Log: "`diag` per diagnostic or uncaught throw (app frames only, max 5), `reload`" becomes "`diag` per diagnostic or uncaught throw (app frames only, max 5; personal data dropped, k.privacy), `csp` (k.security), `reload`".
- Conformance: "On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none." moves to k.security; the clauses after it move up by one.

Full text after the change:
~~~md
# k.server: Thin server
status: conformance-covered

**API.** Apps import only `topology` from `@keel/server`; `loader`/`action` (`@keel/router`) run over HTTP.
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>` encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }` and `ctx`; returns `Result<Href | null, KeelError>`; routes bind it by method (`routes.actions`, k.router).
- `params`/`search` are `Infer` of the declared schemas (else `unknown`), the route's own (E1507); `fn` is never annotated; `url` is absolute.
- A loader whose `fn` is an async generator is live (E1558): a document or JSON GET takes its first yield, an event-stream GET all; args add `signal`.

**Server state.** `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; `fn` gets `S`. An action's `ok` saves its changed stores unless another request saved any of the factory's since (409 `keel.conflict`); `err` or a throw saves none; saves reach `observe` (k.sync). `caller` is the base64url SHA-256 of the cookie token, HMAC-signed with `createApp({ secret })` (<32 bytes: E1556; default per process, W1556 in production); `tx` meta `{ caller }` scopes `undoWhere`. Factory stores skip `#k-state` and inspect; server code never writes module stores; client routers refuse `stores`.

**Request flow.** Match routes -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`, else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). Other routes: 406.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData or JSON (empty: `{}`) by `input` (fail: `keel.fields`, not called), run it, 303 to the target (document) or `Result` JSON (runtime).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 `keel.unexpected` (production: message `unexpected`, no stack). `mode` defaults to `production`. `#k-state` holds every request-scope store.

**Document.** Each route level is a candidate island root by route id. Head, `<html lang>` and the `keel.notFound` alert: k.head. Headers, the policy, the caller cookie and `/__keel/csp`: k.security.

**Build.** Builds, runners, peers, `keel dev`: k.topology. Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag); dev, or no `assets` in development/test, serves `/@keel/entry.ts`.

**Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (app frames only, max 5; personal data dropped, k.privacy), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line.

**Rules.** E1551 `loader`/`action` outside `*.server.ts` (any deployable) · E1554 loader data fails its output schema (dev diag; production 500) · E1555 production `assets` missing or entry-less · E1558 a live loader a non-`node` deployable serves.

**Conformance.**
- A GET with params that fail the params schema returns 404 and calls no loader.
- All loaders of a matched chain start before any of them resolves.
- A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
- A POST with invalid FormData or JSON (empty JSON too) returns 422, does not call the action, and lists the field errors.
- For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
- An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame.
- The dev log stream emits exactly one `req` record per request; in json mode every line parses.
- A JSON or FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action.
- A loader's `url` is the absolute URL of the request it serves.
- Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`. A conflicting or `err` action and an unchanged store save nothing.
- `caller` is the hash of a server-signed cookie token, else of a fresh one set as a cookie on a write, else `""`.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
- An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a document GET renders `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.
~~~

### k.testing (1,485 to 1,459)
- a11y: "After the first render and after every `fire`, the harness compares each element's role and name source with the compiler's `a11y.json` (...) and runs axe." becomes "After the first render and after every `fire`, the harness runs the render checks of k.a11y." (the comparison moves to k.a11y Render checks).
- Ledger: "per public export (`<file>#<name>`) and per spec clause (...)." becomes "per public export (`<file>#<name>`), per spec clause (...) and per route and criterion (`a11y:<routeId>#1.4.3`, k.a11y)."
- Rules and Conformance unchanged.

Full text after the change:
~~~md
# k.testing: Harness and ledger
status: conformance-covered

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
expect(t.state(cart).items).toHaveLength(1)
expect(t.find('cart.total').name).toBe('Total 3')
t.dispose()
const r = await renderRoute('orders.show', { routes, params: { id }, search: {}, ctx: sim })
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`). It resolves once effects, resources, and actions are quiescent.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; `renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused? }, children }`, with implicit roles and accessible names per WAI-ARIA. After the first render and after every `fire`, the harness runs the render checks of k.a11y.

**Properties.**
```ts
properties(CartView)   // generated props and state
properties(addItem)    // generated state and payload
```
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.
```
E1704 cart/addItem.test.ts:3:1 invariant cart.nonNegative failed (seed 4021, run 37, shrunk)
  payload: {"item":{"id":"i1","qty":-1}}
```

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`), per spec clause (`k.router#3`, the 1-based Conformance sentence) and per route and criterion (`a11y:<routeId>#1.4.3`, k.a11y). A conformance test in any package names its clause in a header comment, `// Spec: k.router, clause "<sentence>"`, quoted verbatim (backticks, quote style, spacing, case and the final period aside; it may wrap onto the next `//` lines). `rung` is the highest held:
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a property whose generator's finite domain was fully enumerated.
- `proven`: a passing type-level test or prover output; nothing else may claim it.
- `monitored`: production only; never emitted by the kernel. No evidence: `none`.

`keel ledger --diff` compares with the committed ledger and checks every `conformance-covered` or `frozen` section's clauses.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids) · E1706 ledger rung lower than committed, or unsafe count higher · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it to `// Spec:`).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
- A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line.
- `navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
~~~

### k.head (671 to 766)
- Client: after "where they differ." insert "After a navigation to another route it moves focus to the page's first `h1`, setting `tabindex="-1"`, else to `main`; a navigation within one route keeps focus."; "It writes nothing else" becomes "It changes nothing else".
- Conformance, appended: "After a client navigation to another route, the focused element is the new page's first `h1`, with `tabindex="-1"`, or `main` when it has none; after a navigation that changes only the search, focus is where it was."

Full text after the change:
~~~md
# k.head: Document head
status: conformance-covered

**Purpose.** Every document names its page and its language. The server writes both, and the client router keeps them current on navigation without re-rendering text.

**Title.** A path route may declare `title: (props) => string`, given the route component's props `{ params, search, data }` (k.router), `data` being its loader's `ok` value. A layout with `title` does not compile.
```ts
'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams, loader: loadRecipe,
  component: RecipePage, title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale) },
```
The document's title is the matched route's `title`. Without one, when a loader in the chain returns `err`, and for a 404, it is the fallback: the served deployable's name on a server, the `index.html` title in a `client` deployable (read once at `mount`).

**Language.** `<html lang>` is the matched route's value of its prefix param (k.prefix), read from the matched params; a route without a prefix param, and a 404, give `en`.

**Server.** The head holds, in order: charset, viewport, `<title>`, a `<link rel="stylesheet">` for each `.css` file under `/assets/` that the build manifest's entry chunk names, and `<link rel="icon" href="/keel-mark.svg">` when the build has the mark. In dev, or without a build, it holds the title only. Each value is escaped and nothing is inline, so a strict CSP allows it. The default alert for `keel.notFound` is `<h1>Not found</h1>`.

**Client.** At `mount`, at `resume` and after each navigation's chain has rendered, the router sets `document.title` and `document.documentElement.lang` by the rules above where they differ. After a navigation to another route it moves focus to the page's first `h1`, setting `tabindex="-1"`, else to `main`; a navigation within one route keeps focus. It changes nothing else: no element or text node is rebuilt.

**Rules.** None of its own. A string literal with a letter returned by `title` in a module that lists `@keel/std-messages` is E2406 (std.messages).

**Conformance.**
- A node document for a route with `title` has `<title>` its return value, escaped; for a route without one, after a loader `err`, and for a 404, the deployable's name.
- With a prefix param whose `pathDefault` is `en-US`, the document at `/de-DE/...` has `<html lang="de-DE">` and at the unprefixed URL `<html lang="en-US">`; a route with no prefix param has `lang="en"`.
- After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's.
- After `resume` of a served document, `document.title` and `lang` equal the served document's.
- A built document has the head this section names; an unmatched path is 404 with an `h1`.
- After a client navigation to another route, the focused element is the new page's first `h1`, with `tabindex="-1"`, or `main` when it has none; after a navigation that changes only the search, focus is where it was.
~~~

### k.cli (1,486 to 1,498)
- Commands: after the `ledger` row, "| `evidence [--verify dir]` | the signed evidence bundle (k.evidence) |".
- Output: "Kernel kinds: `diag`, `summary`, `req`, `ledger`, `a11y`." gains "`csp`, `evidence`".
- Trim: "and a summary with node, edge, store, id, a11y, route, and section counts" becomes "and a summary of their counts" (no conformance header quotes it).

Full text after the change:
~~~md
# k.cli: CLI, MCP, LSP
status: conformance-covered

**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`. Three surfaces serve the same engine: the `keel` binary (flags parsed by the input schema), `keel mcp` (one MCP tool per operation; input schema as JSON Schema), and `keel lsp` (check diagnostics as LSP diagnostics, fix diffs as code actions, `explain` as hover).

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check over the code files and `.keel/*.json` artifacts under `paths`, each with its project's `topology.ts` |
| `test [paths]` | harness under sim ctx |
| `build` | production build per deployable |
| `dev` | dev server and log stream |
| `spec <id>` / `--for <code>` / `--map` | one section, sections citing a code, or the map |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect [url]` | summarize a running dev app's inspect document |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural operations (k.scaffold) |
| `ledger` | emit and diff the ledger |
| `evidence [--verify dir]` | the signed evidence bundle (k.evidence) |

`session` runs the operation std.sessions registers with `stdCommand('session', op)` (`@keel/cli`) after importing the project's std `deps`; unfilled, I1055.

Every command accepts `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic-emitting commands also accept `--code <code>`.

**Inspect.** In dev, a running app serves `GET /__keel/inspect` as JSON `{ live, graph, stores, ids, a11y, routes, sections }`: `graph` is `inspect()` outside any request scope, `stores` is `{ [id]: { state, log } }` from `stores()`, and `ids`, `a11y`, `routes` are the `.keel/` artifacts. Node deployables serve it from `createApp` with `mode: 'dev'` (`artifacts` names the `.keel` directory); client-only apps from the compiler plugin's dev and preview servers, where the live half comes from the open page: its dev entry posts `{ graph, stores, sections }` after mount and whenever it changes (`live: false` until a page has posted). Both answer only a loopback or listed `Host` whose `Origin` is the server's own or listed (`createApp({ inspect: { origins } })`; for the plugin, comma-separated `KEEL_INSPECT_ORIGINS`; `:*` any port), echoing a listed cross-origin `Origin` for CORS; an absent `Origin` is admitted for GET only; others get 403 `keel.denied`. `keel inspect [url]` (default `http://localhost:5173`) fetches it and prints one `inspect.store` record per store, one `inspect.section` per section, and a summary of their counts.

**Inspector hooks** (extension point).
```ts
import { inspector } from '@keel/compiler/inspect/inspector'
inspector({ id: 'orders.recent', schema: Recent, read: (ctx) => recent(ctx) })
```
Per request each `read` gets the app's `ctx`; `sections[id]` is `{ doc, value }` (`schema.doc()`, the encoded value), or `{ doc, error }` when `read` throws or its value fails `schema` (E1057, also on the dev log). A client-only app's entry posts them.

**Output.** Exactly OUTPUT.md. Default `compact` when stdout is not a TTY or `KEEL_AGENT=1`, else `pretty`. Exit codes: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry** (extension point).
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => `${r.id} ${r.total}`, pretty: (r) => table(r) })
```
Every output record has a `kind`; each kind has exactly one formatter. `json` is never hand-formatted: it is the record encoded by its schema as one NDJSON line. Kernel kinds: `diag`, `summary`, `req`, `ledger`, `a11y`, `csp`, `evidence`. `@keel/cli/testing` exports `respond(records, { format? })`: renders records as a command does (E1054 included).

**Rules.** I1055 command not available in this build (info; exit 0) · E1051 unknown command · E1052 unknown flag, or flag value invalid for the input schema · E1053 formatter kind or std command registered twice · E1054 record emitted with a kind that has no formatter · E1056 inspect target unreachable, not 2xx, or not an inspect document · E1057 inspector id registered twice (throws), or a section that throws or fails its schema.

**Conformance.**
- For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message).
- Each MCP tool's input schema equals the JSON Schema of its operation's input.
- A clean `keel check` in compact prints exactly one line.
- `keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics.
- Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths.
- In json every line parses, has `kind`, and the last line has `kind: "summary"`.
- With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2.
- `keel nope` emits E1051 and exits 2.
- `keel spec k.cli` prints <= 1,500 tokens.
- `GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the `inspect()` graph; in production mode it is the route table's 404.
- `keel inspect` against an unreachable url emits E1056 and exits 1.
- A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`.
- A dev `createApp` serves each section as `{ doc, value }`; a value failing its schema is `{ doc, error }` with E1057; a second `inspector` with that id throws E1057.
- The served `graph` equals `inspect()` taken outside the request.
- `keel inspect` prints one `inspect.section` per section; an `error` one is E1057, exit 1.
- `respond` of a record of a kind with no formatter yields E1054.
- After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053.
~~~

### std.sessions (1,498 after RFC 0081, to 1,498)
- Module: "A `redact`/`expose` entry is `<subject>:<target>#<path>`: ... `s.secret` values (also in `nav` search) and password inputs are always redacted;" becomes "`redact` entries are `el:<id>` (its values in every event) and `error:<code>#data.<path>`; `expose` entries `tx:<name>#<path>` (payload), `store:<id>#<path>` (state) and `route:<id>#<path>`. `record` keeps every value but masked `redact` entries and `.pii()` values, which become their schema's generated value. `s.secret` values (also in `nav` search), password and `.pii()` inputs are always redacted;".
- Rules: E2001 "or whose path its schema lacks (fix removes it)" becomes "or whose path its schema lacks or marks `.pii()` (fix removes it; `record` throws)".
- Conformance text unchanged; clause 2 gains a 100-run property (Conformance diff).

Full text after the change:
~~~md
# std.sessions: Sessions
status: conformance-covered

**Module.** `@keel/std-sessions` is stdlib module `sessions` (capabilities `clock`, `observe`, `session`, `storage`). Modules set `std['@keel/std-sessions']: { redact?, expose?, readers? }`; only `redact` reaches browsers.
`redact` entries are `el:<id>` (its values in every event) and `error:<code>#data.<path>`; `expose` entries `tx:<name>#<path>` (payload), `store:<id>#<path>` (state) and `route:<id>#<path>`. `record` keeps every value but masked `redact` entries and `.pii()` values, which become their schema's generated value. `s.secret` values (also in `nav` search), password and `.pii()` inputs are always redacted; error messages and `data` (but `data.at`) drop every redacted value. `to-test` also writes each `s.string()` value no `expose` entry names as `x` repeated.

**API.** Capability `session(ctx)`: `put(url, s): Promise<Result<null, KeelError>>` (real: POST, non-2xx `sessions.putFailed`; sim: in `taken(): { url, session }[]`) and `id()`: `random.id('Session')` on its own ctx. `record(ctx, { limit = 500, upload?: URL })` returns `{ events(), errors(), stop(): Session }`, one per ctx until `stop()`; with `upload` it puts the session on the first `error`.
```ts
type SessionEvent = { at: number } & ({ kind: 'tx'; store; name; payload } | { kind: 'nav'; href }
  | { kind: 'resource'; id; state: 'loading' | 'ready' | 'error' } | { kind: 'fire'; id; event: TestEvent } | { kind: 'error'; route; error: KeelError } | { kind: 'net'; online })
type Session = { v: 1; id: Id<'Session'>; seed?; deterministic; at; route: { id; params; search }; state: { [store]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint }
```
The base (`at`, `route`, `state`) is the ctx's route when `record` starts, else its first `nav`. `seed` is `seedOf(ctx)`, absent (and `deterministic` false) when unseeded. `fingerprint`: 12 hex of sha256(`code`, `data.at`, `route`: route id then) of the first `error` event as recorded (none: `''`, `''`, `route.id`). Past `limit` events the buffer drops through its oldest `nav` and rebases there (none: keeps only the new event if an input or error, rebases now).

`replay(session, { routes, redact? })` renders the base (missing stores: `initial`) under a sim ctx of `seed` (absent: 0) at `at`, bound to the recording's `redact` entries, then per event advances the clock to its `at` and applies inputs (`fire`, `nav`, `net`: `setOnline`); others are observations. Groups of users: std.multi. Returns `{ observed, state, error, reproduced, unapplied }`: final `state()`; `reproduced` iff fingerprints match; `unapplied` the index of the input it stopped at, else `null`. `minimize(session, { routes, maxRuns = 200, redact? })`: delta debugging over inputs (at `maxRuns`: smallest found).

**Commands** (k.cli `session`). `capture [url]` saves `sessions.live` · `ingest <url> [--failing] [--since t]` fetches `sessions.list` (cookie `KEEL_SESSIONS_TOKEN`) to `.keel/sessions/<fingerprint>-<n>.json` · `replay <f>` · `minimize <f> [--max-runs n]` rewrites `<f>` · `to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`: header `// Session: <fingerprint>, seed <n>`. The last three run under `keel test` on the deployable serving `route.id`, with its modules' `redact`. The Action `@keel/std-sessions/action` runs them nightly: one `keel-session` issue per reproduced fingerprint, never a push.

**Ingest.** `routes`: `sessions.ingest` (`POST /sessions`, input `Session`, as filed over 256 KiB 413) recomputes `error` and `fingerprint` from `events` and adds it to store `sessions.archive` (per fingerprint `count`, `first`, `last`, newest 5; at most 64 fingerprints and 4 MiB, oldest `last` evicted, never the one written). `sessions.list` (`/sessions/list`, search `{ failing?, since? }`) loads it behind guard `sessions.reader`: `caller` in `readers`, else redirect to `sessions.ingest`.

**Rules.** E2001 `redact`/`expose` entry whose subject is unknown or another module's, or whose path its schema lacks or marks `.pii()` (fix removes it; `record` throws) · E2002 session file fails `sessions.Session` · E2003 replay cannot apply input N or the base · E2004 replay fingerprint differs (`minimize`, `to-test` stop) · E2005 a non-`node` deployable serves `routes` · E2006 a `record` `upload` not credential-free http(s) on the page's origin. E2002-E2004 diag the file at 1:1.

**Conformance.**
- Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then.
- A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema.
- After overflow, a session holds at most `limit` events and its replay ends in the same `state()` as the live app.
- Replaying an unmodified session reproduces every store's final state and its fingerprint.
- `minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal.
- The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied.
- A `to-test` file holds no recorded `s.string()` value outside `expose`, and no `s.secret` or password value.
- A valid POST to `sessions.ingest` is listed under its fingerprint; invalid input is 422 `keel.fields`; a sixth of one fingerprint keeps 5, counts 6; a caller not in `readers` is redirected.
- The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing.
- Without a global `document`, `record` records no event through transactions and errors and never calls `put`.
- E2001-E2005 each fire on a fixture, not on its clean twin.
- `record` throws E2006 on a cross-origin `upload`, not on a same-origin one.
- A POST naming another session's `fingerprint` is filed under its own recomputed one; 20 flood POSTs totalling less than 4 MiB leave an earlier real session in place.
~~~

### spec/00-map.md (orchestrator)
- Code ranges: E110x owner "k.schema, k.privacy"; E105x "k.cli, k.evidence"; E155x "k.server, k.topology, k.security"; E18xx "k.ui, k.a11y".
- Kernel table rows: "| k.a11y | Accessibility | proposed | required props, contrast, focus order, axe-core render checks, WCAG claims |", "| k.security | Headers and CSP | proposed | fixed headers, nonce policy, Trusted Types, reports, caller cookie |", "| k.privacy | Secrets and personal data | proposed | `s.secret`, `.pii(class)`, sinks, no personal data in URLs |", "| k.evidence | Evidence bundle | proposed | `keel evidence`: signed ledger, a11y, policy, PII and dependency records |". The k.ui row's one line drops "a11y-required props".
- About 120 tokens added; the map stays under 1,200 with RFC 0081's move of the stdlib table.

## Conformance diff
The conformance-writer of each lane writes the added files from the accepted spec text, skipped until implementation; each clause is cited verbatim by exactly one file. The moved and edited headers below go in one commit tagged `rfc:0083`.

- **Moved, header re-quoted (rfc:0083).** `packages/schema/conformance/secret.test.ts` (`k.schema` to `k.privacy`, clause text unchanged); `packages/server/conformance/caller-cookie-host-prefix.test.ts` (`k.server` to `k.security`, unchanged text); `packages/ui/conformance/rules-e1801-e1802-types.test.ts` ("k.ui Rules E1801 ... and E1802" becomes "k.ui Rules E1801 ...; k.a11y Rules E1802 ..."); `packages/ui/conformance/rules-e1804-contrast.test.ts` ("k.ui Conformance 6 and Rule E1804" becomes "k.ui Conformance 6 and k.a11y Rule E1804"). The two k.ui a11y clauses stay in k.ui, so `ui-base-elements-axe.test.ts`, `base-elements-axe-core.test.ts` and `ui-e1804-contrast.test.ts` keep their headers.
- **Changed behavior (rfc:0083).** `packages/std-sessions/conformance/redaction.test.ts`, `to-test-redaction.test.ts` and `E2001-redact-path.test.ts` mark their fixture fields with `.pii()` instead of `tx:`, `store:` and `route:` `redact` entries; `E2001-redact-path.test.ts` adds the old subjects and an `expose` under a marked path as E2001 cases and `record` throwing; `redaction.test.ts` becomes a 100-run property over generated payload schemas with marked fields (std.sessions#2 to `probabilistic`). `packages/testing/conformance/rule-E1703.test.ts` keeps its header; its violation ids are axe-core's (`image-alt`, `button-name`, `link-name`, `label` are the same ids).
- **Renumbered ledger items.** k.schema clauses 10 to 12 become 9 to 11, and k.server clauses after the moved cookie clause move up by one. The orchestrator commits the spec text and the regenerated `tooling/ledger/ledger.json` together; the reviewer checks that each moved clause keeps its rung under its new id.
- **Kernel, added.** k.a11y: `packages/check/conformance/a11y-contrast-inherited.test.ts`, `a11y-e1820-reversed.test.ts`; `packages/testing/conformance/a11y-render-contrast.test.ts`, `a11y-document-rules.test.ts`, `a11y-axe-e1703.test.ts`, `a11y-e1821-autocomplete.test.ts`, `a11y-focus-order.test.ts`; `packages/cli/conformance/a11y-ledger-claims.test.ts`; `packages/ui/conformance/a11y-contrast-table.test.ts`. k.security: `packages/server/conformance/security-{headers,policy-nonce,dev-report-only,no-inline,report-log,report-window}.test.ts`, `packages/runtime-dom/conformance/security-trusted-types.test.ts`, `packages/check/conformance/security-{e1570,e1571}.test.ts`, `packages/cli/conformance/security-csp-txt.test.ts` (with the moved cookie file). k.privacy: `packages/schema/conformance/privacy-{derivations,pii-paths,pii-values,doc}.test.ts`, `packages/server/conformance/privacy-diag-scrub.test.ts`, `packages/forms/conformance/privacy-input-mask.test.ts`, `packages/check/conformance/privacy-e1111.test.ts` (with the moved secret file). k.head: `packages/router/conformance/head-focus.test.ts`. k.evidence: `packages/cli/conformance/evidence-{write-verify,tamper,no-key,deterministic,no-pii,pii-coverage,security,failing-run,audit}.test.ts`.
- **Properties for coverage.** `privacy-pii-values`, `privacy-diag-scrub`, `privacy-input-mask` and `evidence-no-pii` run 100 or more seeded runs over generated schemas with marked nodes, so `pii.json` coverage can reach 1.
- **Not conformance.** Property tests (`test/*.property.test.ts`): `contrastTable` is symmetric in ratio and 21 on black and white; `piiValues` of a value with no marked path is empty; the nonce never repeats across 10,000 sim documents of different seeds; a bundle's verification fails for every single-byte change of any file.

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (four new sections, the seven edits, the map). Write the ADRs. Move `axe-core` 4.14.0 from `packages/ui` devDependencies to `packages/testing` dependencies; add the `./a11y` export to `packages/testing/package.json`, `./csp` to `packages/server`, `./evidence` to `packages/cli`. Add `reports/` to the root `.gitignore`. Re-base `tooling/budgets.json` (Token impact). Correct `docs/BRAND.md`'s contrast column with the measured values, and `docs/A11Y-TARGET.md`'s sentence on what `render` runs, now (principle 11), and again when K2 lands. Add `docs/THREAT-MODEL.md` lines for the policy, the report endpoint and personal data, and `docs/ARCHITECTURE.md` Borrow vs build rows (accessibility rules: borrow axe-core, build token contrast; CSP: build, nonce; evidence signing: borrow `node:crypto` Ed25519). Add the `csp` and `evidence` record kinds to `docs/OUTPUT.md`. Run `pnpm install` once. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/OUTPUT.md`, `docs/THREAT-MODEL.md`, `docs/BRAND.md`, `docs/A11Y-TARGET.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 static rules, K3, K4 Trusted Types, K5 marks and mask) | `packages/schema/src/**`, `packages/forms/src/**`, `packages/runtime-dom/src/**`, `packages/router/src/**`, `packages/check/src/**`; their conformance files above; kernel changesets | nothing; lands `.pii()`, `piiPaths`, `piiValues`, `data-k-pii` and the mask first, then Trusted Types and focus, then the check rules | `pnpm --filter @keel/schema --filter @keel/forms --filter @keel/runtime-dom --filter @keel/router --filter @keel/check run check`, the same with `run test` |
| a11y | `packages/ui/src/**`, `packages/testing/src/**`, their conformance files | `data-k-pii` (E1821) from kernel; S5's harness (R1 to R4) | `pnpm --filter @keel/ui --filter @keel/testing run check && pnpm --filter @keel/ui --filter @keel/testing run test` |
| server | `packages/server/src/**`, its conformance files | `piiValues` from kernel | `pnpm --filter @keel/server run check && pnpm --filter @keel/server run test` |
| sessions | `packages/std-sessions/**` | `piiPaths`, `piiValues`, the mask | `pnpm --filter @keel/std-sessions run check && pnpm --filter @keel/std-sessions run test` |
| evidence | `packages/cli/src/**`, its conformance files | `A11yRun` and `criteriaOf` from a11y; `cspPolicy` and `securityHeaders` from server; `piiPaths` from kernel | `pnpm --filter @keel/cli run check && pnpm --filter @keel/cli run test` |
| golden-3 | `evals/tasks/golden-3/**` (TASK.md, `spec-slice.txt`, `task.json`, `acceptance.test.ts`, `browser.ts`, `pass.ts`), `docs/COMPLIANCE.md`, the skill lines in `.claude/skills/{keel,keel-api,keel-forms,keel-testing}/SKILL.md`, and the five package READMEs (written last, from the merged code) | every lane | `pnpm eval --skill keel --runner none`, then after the batch `pnpm eval --task golden-3 --runner claude --strict` builds `apps/golden-3` and `--runner none --strict` re-checks it |

Order: kernel starts first and lands the marks within its first commit, since sessions, server and evidence read them. a11y starts at once (axe-core and the contrast check need nothing new) and adds E1821 when `data-k-pii` lands. evidence builds the command, signing and verification against fixtures first, then joins the a11y and security reports. golden-3 writes TASK.md, the acceptance test and `browser.ts` against the spec during the batch, and the docs once the code merges; the agent build runs after the push. That is five implementation agents and one kernel agent. Mutation runs go alone after the batch (schema, router, runtime-dom, forms, check, server, cli, testing, ui, then std-sessions). Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, ledger diff, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0303's `loadAssets` realpath guard (server lane; it sits beside the asset headers K4 adds); 0273 if RFC 0080's `origin` has not closed it (server lane: `sameSite` behind a TLS proxy, the forwarded-proto rule HSTS also uses); 0270 and 0302 if S4's sessions lane left them open (sessions lane); 0258 (E1303 reducer shapes, `packages/check`) with the kernel lane if its rules work leaves room. 0257 and 0261 (`packages/store`, which no lane owns), 0275 (router and std-sessions search defaults) and 0296 (Node globals in client files) wait. 0223 (P1 launch checklist) reuses this stage's evidence bundle for the site's own review.

## Migration
- **golden-1 and golden-2 under the policy.** Their pages are `client` deployables (`web`), served by their host, so no policy applies to them; `keel build` adds `dist/web/csp.txt`. Their `api` deployables are `node`: every response gains the six headers, and any document gains the policy, the `nonce` attribute and the `csp-nonce` meta. Measured: neither app has an inline script, style, `style` attribute or `on*` attribute in a served document, a cross-origin URL literal (the only absolute URLs are `vite.config.ts` dev proxies, outside app code) or a data URI in its built CSS, so nothing they serve breaks and no source edit is needed. Their tests assert no security header, and the server conformance regexes for the module script (`document-islands.test.ts` lines 81, 109, 111) accept a trailing `nonce` attribute. Under the extended E1804 neither app composes a failing pair (no component puts `textSecondary` text on `surfaceLow`). Under E1111 neither has personal data in a URL. Fix diff: none.
- **apps/inspector.** A `client` app: unaffected by the policy; its cross-origin fetch of another app's inspect document keeps working, which is why S6 sends no meta policy.
- **apps/sessions and std-sessions users.** No app sets `tx:`, `store:` or `route:` `redact` entries (searched: none in `apps/`). A project that does gets E2001 from `keel check` with a fix that removes the entry, and `record` throws until the field is marked `.pii()`. Sessions recorded before still parse.
- **Kernel callers.** `.pii()`, `autocomplete`, `focusOrder()`, `contrastTable`, the `csp` record kind and `keel evidence` are additions. The harness's E1703 now comes from axe-core: a component that passed the four old rules can fail a WCAG-tagged axe rule, which is the point; each such failure in `packages/*/test` or the golden apps is fixed in the a11y lane's batch, and none is suppressed. Focus after navigation changes `document.activeElement` in router tests that assert it (none found).
- **Docs.** Listed under Lanes (orchestrator prep and the golden-3 lane).

## Token impact
Sections after the change (measured): k.a11y 1,281, k.security 1,162, k.privacy 1,001, k.evidence 1,071 (new); k.ui 1,421 (from 1,498), k.schema 1,272 (from 1,498), k.server 1,458 (from 1,499 after RFC 0081), k.testing 1,459 (from 1,485), k.head 766 (from 671), k.cli 1,498 (from 1,486), std.sessions 1,498 (unchanged). k.cli and std.sessions are within two tokens of the cap: their next change needs a split first (k.cli's seam is its **Inspect** paragraph, std.sessions' its **Ingest** paragraph). A task building a compliant app reads k.a11y, k.security and k.privacy, about 3,450 tokens; the golden-3 spec slice keeps their key lines. The four skills grow by about 160 tokens in total.

Package sizes (gzip, the `tooling/budgets.mjs` rule; today measured, the rest estimated):

| Package | Today | Estimate | `budgets.json` |
| --- | --- | --- | --- |
| `@keel/schema` | 4,683 B | +0.35 kB (`pii` on nodes, `piiPaths`, `piiValues`, `doc` and JSON Schema) | `5kb` (5,120 B) is crossed; re-base to `5.5kb` with the measured bytes in the commit (default 7) |
| `@keel/ui` | 3,128 B | +0.3 kB (`autocomplete`, `contrastTable`) | `4kb` holds |
| `@keel/forms` | 4,332 B | +40 B | `5kb` holds |
| `@keel/runtime-dom` | 4,066 B | +0.12 kB (Trusted Types policy, mask selector) | `6kb` holds |
| `@keel/router` | 9,479 B | +0.12 kB (focus) | `9.5kb` (9,728 B) holds by about 130 B |
| `@keel/server` | 14,575 B | +1.3 kB (headers, policy, report endpoint and window, `diag` scrub) | inside RFC 0080's re-base to `16kb` only if S3 and S4 leave 1.3 kB; else re-base to `17kb` |
| `@keel/testing` | 6,974 B | +1.5 kB (axe-core runner, render contrast, `focusOrder`, report writer; axe-core itself is external) | `9kb` holds |
| `@keel/cli` | 19,166 B | +3 kB (evidence, verify, SBOM, ledger claims) | `22kb` is crossed; re-base to `24kb` |
| `@keel/std-sessions` | 6,957 B | +0.2 kB (mark-driven paths, subject check) | `7kb` (7,168 B) is crossed; re-base to `7.5kb` |

App bundles grow by the `@keel/ui`, `@keel/forms`, `@keel/runtime-dom` and `@keel/router` deltas, about 0.6 kB gzip; axe-core never ships to a browser.

## Known limits
- **Claims are about checks.** A route at `example` for 1.1.1 has every image named; whether the name is a good one is the auditor's call. Criteria no rule maps to (most of 1.2, 2.2 and 3.3) are listed for a person and never claimed.
- **Contrast without layout.** The render check reads tokens, not pixels: text over an image (Keel has no background-image style) or an overlap from negative margins is not seen. The eval's browser pass runs axe's own `color-contrast` once per stage.
- **Trusted Types where implemented.** Chromium enforces it; engines without it ignore the directive and rely on the nonce policy and escaping.
- **`client` and `static` deployables.** Keel serves no policy for them; `csp.txt` is the recommended header, and whether the host sends it is outside the bundle's proof.
- **Nonce documents are not shared-cacheable.** Every `node` document is already per request; a CDN in front must not cache documents.
- **404 paths.** A request no route matches is logged with its path as requested, since no schema can mark it; E1111 covers every path a route declares.
- **Copies of personal data.** A marked value copied into an unmarked field, or derived (`email.toUpperCase()`), is not redacted; the scrub matches values as decoded.
- **Firefox.** Not in the local Playwright cache, so the browser gate runs Chromium and WebKit; installing Firefox is a network step for the orchestrator.
- **Signing identity.** A signature proves the bundle is unchanged since a holder of the key signed it; who holds the key is the project's process, published as the `keyId`.

## ADRs
Written with this RFC's acceptance, in `docs/adr/`, numbered by the orchestrator after RFC 0082's:
- **Accessibility claims come from axe-core and token contrast, per route and WCAG criterion** (K1, K2, k.a11y). The harness borrows axe-core for WCAG-tagged rules and builds contrast from atomic classes and tokens, since happy-dom has no colors; claims are ledger items `a11y:<routeId>#<criterion>` at `example` or `none`. Chosen over Keel's own rule set (a second engine to maintain), over real browsers in `keel test` (no sim determinism) and over claims per criterion without routes (hides where a failure is).
- **Focus moves to the page heading after a client navigation** (K3, k.head). The first `h1`, else `main`, with `tabindex="-1"`; search-only navigations keep focus. Chosen over a live-region announcement (the title already changes; screen readers read the focused heading) and over leaving focus (it can sit on a removed link).
- **One fixed nonce policy with Trusted Types, reports to the app's own log** (K4, k.security). Per-response nonce with `'strict-dynamic'`, no option to widen, `keel` the only Trusted Types policy, `/__keel/csp` without the write proof but capped and redacted; `client` and `static` get `csp.txt`. Chosen over `'self'` allowlists (bypassable), hashes (no inline script to hash), a configurable policy (every option widens it), a meta policy (no `frame-ancestors`, breaks the inspector) and a third-party collector (sends URLs out).
- **Personal data is a schema mark from a closed class set; sinks redact by schema** (K5, k.privacy, std.sessions). `.pii(class)` keeps types and derivations; sessions, inputs, logs and the bundle redact; URLs refuse marked data; `redact` keeps `el:` and `error:` only. Chosen over a wrapper type (personal data must flow), free labels (no inventory) and config paths beside the mark (two ways).
- **The evidence bundle is an offline, Ed25519-signed directory built from the k.cli operations** (K6, k.evidence). Runs check, test and ledger in process, holds no app value, verifies without the source. Chosen over Sigstore (external identity and log), over a stdlib command (needs kernel operations; `stdCommand` reserves `session`) and over running `pnpm audit` inside (network).

## Open questions
Each needs the user under WORKFLOW's escalation list; the recommendation follows each.

- **Q1. New hand-written API shapes** (escalated: new user-facing API). `.pii(class)` with `PiiClass` (`name`, `contact`, `location`, `identifier`, `financial`, `special`, `network`, `content`); `autocomplete: Autofill` on `Input`, `TextArea`, `Select`; `focusOrder()` on harness handles; `contrastTable(tokens)`; `keel evidence [--out] [--audit]` and `--verify <dir> [--key]` with `KEEL_EVIDENCE_KEY`. Recommendation: accept as a set; each is the smallest shape its claim needs (defaults 1 and 6).
- **Q2. `redact` loses `tx:`, `store:` and `route:`** (escalated: privacy). Recommendation: accept. It does not weaken redaction: every such path becomes a `.pii()` mark that also covers logs and inputs, `record` throws on a leftover entry instead of recording the value, and E1111 removes marked data from URLs (defaults 2 and 4). No app in the repo uses those subjects.
- **Q3. External parties** (escalated: external integrations). (a) CSP reports go to the app's own `/__keel/csp`, no outside collector: recommend. (b) Dependency advisories come from a `pnpm audit --json` file CI passes; `keel evidence` makes no network call: recommend. (c) Ed25519 with a project key in `KEEL_EVIDENCE_KEY`, not Sigstore: recommend; a later RFC can add a transparency log. (d) The accessibility auditor and the pen-test firm, their dates and budget, and whether the deployment is public or allowlisted: the user's choice; recommend one firm per discipline, a WCAG 2.2 AA scope with a desktop and a mobile screen reader, and an OWASP ASVS level 2 scope, both receiving the bundle and THREAT-MODEL.
- **Q4. Golden-app migrations** (escalated). golden-1 and golden-2 change no source; their `api` responses gain headers and their builds gain `csp.txt`. Recommendation: accept; no eval reruns beyond the batch-end ones.
- **Q5. Brand contrast** (a brand decision). `textSecondary` (`#71717A`) on `surfaceLow` measures 4.36:1 and fails 1.4.3 wherever a component composes the pair; BRAND.md's table overstates three ratios. Recommendation: darken `textSecondary` to `#6B6B74` (4.75:1 on `surfaceLow`, 5.01:1 on `surface`) in `brandTokens` and BRAND.md, and correct the table now.
- **Q6. Policy for `client` and `static` deployables.** Recommendation: `csp.txt` only in S6 (Proposal 5); a later RFC can add per-deployable allowed origins and a build-time meta policy once a declared-origins shape exists.

**Borrow vs build, with evidence.**
- **axe-core, not more of Keel's own rules.** Keel's harness has four rules; axe-core 4.14.0 is installed, its WCAG 2.0 to 2.2 A and AA tags pass on every base element under happy-dom 21.0.4 in `base-elements-axe-core.test.ts`, and its rule tags give the criterion map the claims need. Build only what happy-dom cannot do: contrast, from tokens.
- **Nonce, not hash, for `node` documents; `'self'` only where no server exists.** Documents are per request and hold no inline script, so a hash policy has nothing to hash; Vite's helper already reads `csp-nonce` (measured in golden-2's build); `'strict-dynamic'` admits the entry's chunks without host lists. `client` and `static` builds have no per-response hook, so their `csp.txt` uses `'self'`.
