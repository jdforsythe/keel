# RFC 0244: end-to-end tests, `keel test --e2e` over the built app

Status: implemented (ADR-0267) but k.e2e Libraries (`serve({ page })` in a library's folder), accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Adds k.e2e and k.e2e-page (implemented). Amends k.cli (the `test` row), k.test-run (Run report, one clause) and k.ledger-items (Run evidence, one clause), the map, `tooling/docs-owners.json` and the glossary (**end-to-end test**). New codes E1734 to E1738. From decision D187 (b) of task 0963 and the A2 end-user review (`tasks/p1/end-user-review.md`).

## For the operator
1. **`--e2e` runs the e2e files alone, not every rung.** Recommended. A7 asks for every rung from one command. `keel test` and `keel test --e2e` share one runner, one reporter, one report folder and one ledger, and the scaffolded CI runs both. Folding e2e into plain `keel test` would make every page-test run build the app and need a browser. To reverse, `keel test --all` runs both in order.
2. **`keel test --e2e` always builds.** Recommended: a stale `dist/` proves nothing about the code under test. The cost is one `keel build` per run (Cost). To reverse, add a `--built` flag that trusts `dist/`.
3. **No sim control reaches a built app.** Recommended, and stated in k.e2e Control. Playwright's fake browser clock is left out because the server's clock would not move with it.
4. **No `e2e:` ledger item kind for now.** Recommended. A passing e2e test is `example` evidence on the items it uses, like any test. A6 may later want "this route was opened in a real browser" as its own item. That can be added when an evidence reader asks for it.
5. **The shell smokes stay as tooling.** `shell.mjs`, `shell-drive.mjs` and `shell-launch.mjs` drive a Tauri binary, macOS accessibility and XCUITest. The page API here is a browser tab. A native-shell driver behind the same verbs is a follow-up RFC (Migration).
6. **Map titles trimmed.** Recommended. The spec map had 17 tokens of room and `keel docs` had 1. Instead of raising either budget, eight map titles are shortened with no change of meaning: `Secrets, pii`, `Server deps`, `Surface compat`, `Library pack`, `Escape review`, `A11y`, `Proofs`, `Exploration`. To reverse, restore the titles and re-base `spec.map` to 1,680 and `docs.map` to 1,710.

## Decisions
- D1: a file `test/**/*.e2e.ts` or `modules/*/test/**/*.e2e.ts` is an end-to-end test. `keel test` runs none. `keel test --e2e [paths] [--engine chromium|firefox|webkit]` runs them alone, in three steps: `keel build`, a browser check, then vitest (node, forks, two files at once).
- D2: `@keel/testing/e2e` exports `serve`, `answer` and `build`. One export per file. Ids are the only selectors, and E1701 holds in an e2e file.
- D3: `playwright-core` is an optional peer dependency pinned to one version, as `z3-solver` is for `prove`. If it is absent, or the engine's browser is absent, the result is one E1734 with the install step, and the run fails without reporting a skip.
- D4: `serve` starts the topology's deployables from `dist/`. It picks free ports, makes a fresh data folder, uses one random `KEEL_SECRET` per `serve`, wires peers, and sets `KEEL_FORMAT=json` so the server log can be read. `static` and unserved `client` deployables are hosted as k.hosting says a static host does. `env` adds or replaces values.
- D5: the page takes the harness's verbs on a real tab. It adds what only a real browser has (D8). No verb sleeps.
- D6: a built app runs on a real ctx, and the spec says which controls reach it and which do not.
- D7: a failure prints one T0001, then the server records from the failing verb, a screenshot and a trace. A browser problem the test does not read is E1738.
- D8: the API covers every smoke except the native-shell ones (Migration).
- D9: there is no new rung and no new item kind. e2e files are test files the ledger reads, and the run report is `reports/tests/e2e.json`.

## Problem
What exists:
- `@keel/testing` covers the harness rungs in one process: `render`, `renderRoute` (with `app`, a built `node` page served from `createApp` and resumed in happy-dom), `fire`, `find`, `settle`, `a11y`, `requests()`, `properties`, `explore`, `prove` and `simulate`, all on a sim ctx (k.testing, k.sim). None of it loads the built bundle, the content security policy as a server sends it, a real resume, a real history, a real cookie jar, a service worker or a browser's offline state.
- The repo proves those things with 19 scripts in `tooling/smoke/`. They share helpers (`built.mjs`: `freePort`, `copyApp`, `buildIn`, `serve`, `ready`, `recorder`, and `row`, which reads SQLite rows), and they drive Chromium through `@playwright/test`'s `chromium` with CSS id selectors (`[id="app.home.title"]`, `#todos\.addList`). They wait with `locator.waitFor` and hand-rolled 100 ms polling loops, with some fixed sleeps (`wait(1000)` in `resume.mjs`), and bound time with `testTime` and `fixedTime` (`tooling/test-time.ts`). CI runs eleven of them in one `built-smokes` job and the shell smokes in four platform jobs.
- No app can use any of this. An A2 reviewer installed Playwright by hand to see a page work in a browser. A7, the tester, comes from Playwright and Cypress and asks whether every rung runs from one command without building a harness, and whether a red test names its cause. Today the answer is no for the top rung.

Personas: A7 (the whole RFC), A2 (D1, D4), A8 (D4: the same `server.mjs` and variables a deploy uses), A6 (cookies without values, the scrubbed server log, `problems()` with `csp`), K2 (worked case 1), K5 and K8 (worked case 2, `offline`), L1 (Libraries).

## Proposal
### Files and the command
```
test/checkout.e2e.ts          modules/shop/test/cart.e2e.ts
keel test --e2e               build, browser check, run the e2e files
keel test --e2e test/checkout.e2e.ts --engine webkit
```
`keel test` keeps its include globs, which end in `.test.{ts,tsx}`, so it never picks up an e2e file. `--e2e` replaces `include` with the two e2e globs and sets `environment: 'node'`, `pool: 'forks'` and at most two files at once. A browser per file and a server per test are heavy on a shared machine, so the cap is kept low. It also sets `KEEL_TEST=1` and `KEEL_E2E=1`. The project's plugins and setup files stay. An e2e test that declares no timeout has 60 s, scaled.

### The API
```ts
// @keel/testing/e2e: one export per file
export function serve(options?: ServeOptions): Promise<Served>
export function answer(handler: (request: Request) => Response | Promise<Response>): Promise<Answered>
export function build(project: string): Promise<void>   // keel build in another folder, for a test that edits a copy

type ServeOptions = {
  project?: string                                              // default: where keel test runs
  env?: Record<string, string> | ((data: string) => Record<string, string>)
  origins?: Record<string, Answered>                            // browser requests to these origins reach the handler
  dev?: true                                                    // keel dev in place of the built deployables
  page?: Component; props?: Record<string, unknown>             // a library's folder only
}
interface Served {
  origin(deployable?: string): string
  open(path: string, options?: { deployable?: string; scripts?: boolean; hold?: boolean }): Promise<Page>
  fetch(path: string, init?: RequestInit & { deployable?: string }): Promise<Response>
  serverLog(deployable?: string): readonly LogRecord[]           // OUTPUT.md Server log, parsed
  state<T>(store: Store<T>): Promise<T>
  until<T>(store: Store<T>, test: (value: T) => boolean, wait?: Wait): Promise<T>
  stop(deployable?: string): Promise<void>                      // SIGKILL
  start(deployable?: string): Promise<void>                     // same port, same data
  dispose(): Promise<void>
}
interface Page {
  fire(id: string, event: TestEvent): Promise<void>             // k.testing's TestEvent, sent as a person's act
  press(key: string): Promise<void>
  find(id: string): Promise<Found>                              // waits until shown; Found as k.testing's
  findAll(prefix: string): Promise<readonly Found[]>
  until(id: string, match: Match, wait?: Wait): Promise<void>
  settle(): Promise<void>
  a11y(id?: string): Promise<A11yNode>
  navigate(path: string): Promise<void>; reload(): Promise<void>; back(): Promise<void>
  location(): Promise<{ path: string; entries: number }>
  documents(): Promise<readonly { method: string; url: string; status: number }[]>
  requests(): readonly SentRequest[]                            // k.requests' shape
  cookies(): Promise<readonly CookieInfo[]>                     // no values
  fetch(path: string, init?: RequestInit): Promise<Response>    // with this context's cookies
  offline(on: boolean): Promise<void>
  scroll(y: number): Promise<void>
  viewport(size: { width: number; height: number }): Promise<void>
  layout(id?: string): Promise<Layout>
  style(id: string, names: readonly StyleName[]): Promise<Partial<Record<StyleName, string>>>
  resume(): Promise<void>                                       // a held page: run its scripts, check the claim
  problems(): readonly Problem[]                                // page errors, console errors, policy violations
  open(path: string): Promise<Page>                             // another tab, same context
}
type Match = { text?: string | RegExp; name?: string; role?: string; state?: FoundState; gone?: true }
type Wait = { within?: number; fixed?: number }
```
A page test moves to end to end with three changes: `renderRoute(id, …)` becomes `(await serve()).open(path)`, `find` gains an `await`, and an assertion on text that arrives later becomes `until`. The verbs keep their names and arguments. `state(store)` moves from the page to `Served`, since in a built app the page's client stores are not readable from outside, and the server's are, through the storage driver.

Ids are the selector contract, as in every test (k.testing, E1701). An id absent from `.keel/ids.json` is E1705 before the browser is asked anything, so a typo is named at once instead of after a 10 s wait. Ids with keys (`shopping.toggle.<itemId>`) are found with `findAll('shopping.name')`, and the key is read off the returned `id`. There is no CSS, role or text locator and no `evaluate`. A check the verbs cannot make is made by a fixture page whose control does the thing, and `problems()` or `requests()` shows the result.

### What it builds, starts and isolates
- `keel test --e2e` runs `keel build`, which runs `keel check` first. The one input it adds: for an unserved `client` deployable, `KEEL_PEER_<NAME>=http://<name>.peer.keel.test` for each `node` deployable. Each `serve`'s proxy sends that host to the deployable's real port, so a page served from one origin calls a peer on another. CORS and the content security policy then apply as they would in a deploy.
- `serve` per `node` deployable runs `node dist/<name>/server.mjs` with the variables of the keel-deploy skill. `PORT` is a free port from the OS, retried up to three times on E1560. `KEEL_SECRET` is shared across one `serve`. `KEEL_ORIGIN` is set. `KEEL_PEER_<NAME>` and `KEEL_ALLOW_ORIGINS` are set. Storage goes in the data folder: the web-storage flags for `'file'` and a SQLite file for `'sqlite'`. `'postgres'` needs `KEEL_DATABASE_URL` from `env`. A module's `env` names (`KEEL_POSTGRES_URL`) come from `env`, else E1737. A static-only app (A1) starts no process: the run's static host serves `dist/<name>/` with `csp.txt` as the header.
- Readiness is any HTTP answer to `GET /` within 20 s, scaled. A process that exits, or never answers, is E1737 with its last 10 log records.
- Isolation: each `serve` has its own processes, ports, data folder and secret. Each `open` has its own context, with its own cookies, storage, service workers and cache. Handles are disposed at the test's end as harness handles are (k.test-run Disposal), passed or failed. Processes are stopped, the folder is removed, and the watchdog's child-process kill backs both up.
- `answer(handler)` is an origin the test owns: a loopback server with a request log. A server reaches it through `env` (`PAYMENTS_URL`). A browser reaches it through `origins`: each context's proxy sends that origin's requests to the handler, ending `https` with a certificate `@keel/testing` ships and only those contexts trust, and passes everything else through unchanged.

### The browser
`playwright-core` is the driver. It is the library without a runner, so vitest stays the one runner. The engines are Chromium (the default), Firefox and WebKit, and each is installed with `playwright-core install <engine>`. If the package or the engine's browser is missing, the result is E1734 before any file runs, with the fix:
```
E1734 package.json:1:1 playwright-core is not installed
  fix: +    "playwright-core": "1.65.0",
fail test
```
The run fails. A missing browser never leads to a test reported as skipped.

### Determinism, honestly
A built app runs on a real ctx. What a test controls:
- the browser's network (`offline`), service workers included;
- each deployable's life (`stop`, `start` on the same port and data);
- the answers of mapped origins and of servers it points at an `answer`;
- the data a `serve` starts from, which is always empty;
- when a held page's scripts run (`hold`, `resume`).

What does not reach a built app, with nothing standing in for it:
- the sim clock and `advance`;
- the seed of `ctx.random`;
- a net schedule's delays, `drop`, `lost` and `unavailable`;
- storage faults;
- `simulate`, its shrinking, and `replay`.

A test of a timer waits the real time, written as `fixed` so it does not scale. Those properties stay at the rung that has the machinery for them, `simulate`. The ledger reflects that: e2e evidence is `example`.

### Waiting without sleeps
A page is quiet when nothing it sent is unanswered, the DOM has not changed for one animation frame, and no navigation is under way. Event streams are left out of the first condition because a live page's stream never ends, the reason the smokes avoid `networkidle`. `fire`, `open`, `navigate`, `reload` and `back` resolve once quiet. `find` and `until` re-read on each DOM change. `Served.until` re-reads on each commit the storage's `watch` reports, else every 100 ms. Every wait is bounded at 10 s, and `within` and `fixed` set the bound. The bound is scaled by `KEEL_TEST_TIME_SCALE` and the fixed part is not, as docs/TESTING.md Time scale says, so `KEEL_TEST_TIME_SCALE=0.1` finds the bounds a slow runner would cut. Structure-lint S0016 covers an e2e file like any test.

### What a failure prints
```
T0001 test/checkout.e2e.ts:24:14 E1735 until shop.checkout.error: text was "", not "Your card..." after 10.0s
  server: POST /checkout shop.checkout 500 41ms
  server: E1577 uncaught rejection in work of route shop.checkout
  screenshot: reports/e2e/checkout.e2e-24-1.png
  trace: reports/e2e/checkout.e2e-24-1.zip
fail test 1 failed
```
The message names the verb, the id, what was seen and the bound. The `server:` lines are the compact records each deployable of the `serve` wrote from the start of the failing verb, at most 10. They are already scrubbed of secrets and pii (k.serverlog), so a failure prints no card number. Each context records a Playwright trace (DOM snapshots, network, console), which is written only when a test fails, under `reports/e2e/`, which is not committed. A page error, a console error or a policy violation the test did not take with `problems()` fails it with E1738, which names the first one. Every smoke asserted "no console or page errors" by hand, and an e2e test gets that check without asking for it.

### What it proves that lower rungs cannot
- the built bundle as Vite and the compiler emit it, with hashed assets, the `keel-peer` tags and the boundary stubs;
- the content security policy as the server sends it, with violations reaching `problems()` and the server's `csp` records;
- a real resume: `hold`, typing and scrolling before scripts run, and `resume()` rejecting E1720 when a claim replaced a served element or moved focus, value, caret or scroll;
- real navigation, history and reload;
- cookies and sessions in a real jar (`cookies()`: names and flags, never values);
- a service worker and the browser's own offline state;
- axe-core over the page as the browser renders it, real `color-contrast` included (E1703).

Two things it does not prove. A native shell is out of scope here (For the operator 5). The checks in `a11y()` are the harness's rules run in the page: they show the page passes those rules, and they are not a WCAG audit.

### Ledger
An e2e file is a test file the ledger reads, so a passing e2e test gives `example` evidence to each item its body references, as any test does: an export it imports (a store for `state`), and a spec clause when a conformance file is an e2e file. It adds no rung, because one passing run in a real browser is exactly `example` strength. It adds no item kind (For the operator 4). The a11y checks of an e2e page fail the test on a violation and write no `reports/a11y.json` run. The harness's `renderRoute` already gives each route's a11y items their `example` evidence, so a second writer of that file would add nothing to the rung and would race it. `keel test --e2e` writes `reports/tests/e2e.json`, and `keel test` writes `run.json`, each leaving the other in place. A project with an e2e file and no `e2e.json` is W1733 (k.ledger-items Run evidence), so a ledger written without the e2e run says so.

### Libraries
In a library's folder, `serve({ page: Card, props })` builds a one-route `client` deployable that renders the component under the library's tokens, and hosts it. `open('/')` then gives L1 a real-browser test of focus rings, `style`, `layout` at a `viewport`, and axe, from the library's own folder, with no app.

### Worked case 1: a storefront
A cart that survives a reload and a declined payment, with card data kept out of the server log (K2). The payment provider is an `answer`, and the app reaches it through its module's `env`.
```ts
// test/checkout.e2e.ts
import { expect, it } from 'vitest'
import { answer, serve } from '@keel/testing/e2e'

const CARD = '4000 0000 0000 0002'

it('keeps the cart over a reload and through a declined payment', async () => {
  const payments = await answer(() => Response.json({ code: 'card_declined' }, { status: 402 }))
  const app = await serve({ env: { PAYMENTS_URL: payments.origin } })
  const page = await app.open('/products')

  const rows = await page.findAll('shop.products.row')
  expect(rows.map((r) => r.id)).toEqual(['shop.products.row.p1', 'shop.products.row.p2', 'shop.products.row.p3'])
  await page.fire('shop.products.add.p1', { type: 'click' })
  await page.fire('shop.products.add.p2', { type: 'click' })
  await page.until('shop.cart.count', { text: '2' })

  await page.reload()
  expect((await page.find('shop.cart.count')).text).toBe('2')
  expect((await page.cookies()).find((c) => c.name.endsWith('keel-caller'))?.httpOnly).toBe(true)

  await page.navigate('/checkout')
  await page.fire('shop.checkout.form:card', { type: 'input', value: CARD })
  await page.fire('shop.checkout.pay', { type: 'click' })
  await page.until('shop.checkout.error', { text: 'Your card was declined. Nothing was charged.' })

  expect((await page.location()).path).toBe('/checkout')
  expect((await page.find('shop.cart.count')).text).toBe('2')
  expect(payments.requests()).toHaveLength(1)
  const posts = app.serverLog().filter((r) => r.kind === 'req' && r.method === 'POST')
  expect(posts.map((r) => (r.kind === 'req' ? `${r.path} ${r.status}` : ''))).toEqual(['/cart 303', '/cart 303', '/checkout 422'])
  expect(JSON.stringify(app.serverLog())).not.toContain(CARD.slice(0, 9))
  await page.a11y()
})
```

### Worked case 2: the household's offline mark
The flow `tooling/smoke/household.mjs` runs at its outbox step (K5, K8): a mark Grace makes offline waits on her page, Ada's page does not see it, and once Grace is back the mark goes and reaches Ada with no reload.
```ts
// apps/household/test/outbox.e2e.ts
import { expect, it } from 'vitest'
import { serve, type Page } from '@keel/testing/e2e'

const PASSWORD = 'correct horse battery staple'

async function member(page: Page, name: string, email: string): Promise<void> {
  await page.fire('members.signupForm:name', { type: 'input', value: name })
  await page.fire('members.signupForm:email', { type: 'input', value: email })
  await page.fire('members.signupForm:password', { type: 'input', value: PASSWORD })
  await page.fire('members.signupSubmit', { type: 'click' })
  await page.fire('members.signinForm:email', { type: 'input', value: email })
  await page.fire('members.signinForm:password', { type: 'input', value: PASSWORD })
  await page.fire('members.signinSubmit', { type: 'click' })
  await page.navigate('/list')
  await page.until('shopping.live', { text: 'Live' })
}

async function itemId(page: Page, name: string): Promise<string> {
  const row = (await page.findAll('shopping.name')).find((r) => r.text.startsWith(name))
  if (row === undefined) throw new Error(`no row ${name}`)
  return row.id.slice('shopping.name.'.length)
}

it('a mark made offline waits on the page and is sent once the browser is back', async () => {
  const app = await serve({
    env: (data) => ({ KEEL_POSTGRES_URL: `pglite:${data}/postgres`, BETTER_AUTH_SECRET: 'e2e-secret-of-32-characters-or-more' }),
  })
  const ada = await app.open('/signup')
  await member(ada, 'Ada Lovelace', 'ada@example.com')
  const grace = await app.open('/signup')
  await member(grace, 'Grace Hopper', 'grace@example.com')

  await ada.fire('shopping.staples.trigger', { type: 'click' })
  await ada.fire('shopping.staples.item.apples', { type: 'click' })
  const apples = await itemId(ada, 'Apples')
  await grace.until(`shopping.name.${apples}`, { text: /^Apples/ })
  const loads = (await grace.documents()).length

  await grace.offline(true)
  await grace.until('shopping.live', { text: 'Offline' })
  await grace.fire(`shopping.toggle.${apples}`, { type: 'click' })
  await grace.until(`shopping.waiting.${apples}`, { text: /waiting to send/ })
  await ada.fire('shopping.view.tab.bought', { type: 'click' })
  expect(await ada.findAll(`shopping.toggle.${apples}`)).toHaveLength(0)

  await grace.offline(false)
  await grace.until('shopping.live', { text: 'Live' })
  await grace.until(`shopping.waiting.${apples}`, { gone: true })
  await ada.until(`shopping.toggle.${apples}`, { text: 'Back on the list' })
  expect((await grace.documents()).length).toBe(loads)
  const offlineOnly = grace.problems().every((p) => p.kind === 'console' && p.text.includes('ERR_INTERNET_DISCONNECTED'))
  expect(offlineOnly).toBe(true)
})
```
Both cases type-check with strict `tsc` against the declarations above. `documents()` takes the place of the smoke's `window.smokeMark` sentinel: no new document means no reload. The browser's own network errors while offline are console errors, and the test reads them, so E1738 does not fire. A real console error the test did not expect would still fail it.

## Alternatives
- **Document Playwright and the built server, ship nothing.** Each app would build the harness the smokes already are: ports, secrets, peers, readiness, data folders, cleanup, sleeps, CSS selectors. A7's question would get a no, and the ledger could not read the evidence.
- **`@playwright/test` as the runner.** It is a second runner beside vitest, with its own config, timeouts, report and fixtures, which makes two ways to write a test. Its locators (role, text, CSS) are the selectors E1701 refuses.
- **Cypress.** It runs in the browser, so starting and stopping the server, `answer` and `state` would cross a process boundary in every test. It supports one engine family well.
- **WebDriver BiDi directly.** It is cross-engine on paper. In practice, offline, tracing and per-context proxies differ by engine today, and the repo's shell smokes already carry a WebDriver client for the one place it is needed.
- **A sim clock in the browser.** It moves the page's clock and not the server's, so leases, workflow steps and cookies' `Max-Age` would disagree between the two. Half a control, shown as a whole one, is a claim the tool cannot check.
- **e2e inside plain `keel test`.** It would put a build and a browser on every page-test run (For the operator 1).
- **A new rung.** A rung ranks how much of the input space a test covers. A real browser changes what is under test, not how much of it, so a new rung would misrank it.

## Spec diff
- New `spec/kernel/k.e2e.md` (proposed): Files, Build input, Browser, serve, Served, Answered origins, Isolation, Libraries, Control, Time, Ledger, Rules, and 14 clauses.
- New `spec/kernel/k.e2e-page.md` (proposed): open, Verbs, Waits, Problems, Failure output, Rules, and 14 clauses.
- k.cli: the `test` row reads `test [paths] [--e2e]`, harness under sim ctx; `--e2e`, the built app in a browser (k.e2e).
- k.test-run Run report: without `shard`, `writeTestReport` removes the folder's other files but `e2e.json`. One clause.
- k.ledger-items Run evidence: what a test file is (`.test.` or `.spec.` before a script extension, or an e2e file). One clause.
- Made exact while building: a verb's id is refused (E1705) when it is not in `.keel/ids.json`, not `<id>.<key>` under one of its ids or a template id's head the source writes, and not a form field's `<formId>:<path>`; `find` gives `value` as k.testing's does; `focusOrder()` is a page verb; a held page's parked scripts are not waited on; the held-page clause reads the caret with `press('x')` and the input's `value`; the cookie clause's cookie is the caller cookie a form POST mints; the problem clause's handler rejects with `Error('boom')` (app code may not `throw`); an artifact is `<file>-<line>-<n>`, `<file>` less its `.ts`, `<line>` the T0001's; the defaults (10 s a wait, 20 s a start, 60 s a test) are fixed time and only `within` scales (docs/TESTING.md Time scale), so the timeout clause reads 60 s at scale 0.1.
- Map: rows `k.e2e` and `k.e2e-page`, `k.e2e` added to the E170x block, and eight titles shortened (For the operator 6). `tooling/docs-owners.json`: both sections owned by `@keel/testing`. Glossary: **end-to-end test**.

## Conformance diff
The conformance-writer covers k.e2e's 14 and k.e2e-page's 14 clauses, k.test-run's new clause and k.ledger-items' new clause, citing each word for word. Proposed files: `packages/cli/conformance/e2e-command.test.ts` (k.e2e clauses on `keel test --e2e`, E1734, E1736, the report files, time); in `packages/testing/conformance/`, `e2e-serve.test.ts` (serve, peers, static, E1737, isolation, stop and start, `until`, answered origins), `e2e-page.test.ts` (verbs, waits, E1705, E1735, hold and resume, offline, cookies, documents, style), `e2e-failure.test.ts` (E1738, the T0001 output, `reports/e2e/`, a11y E1703). k.test-run's clause goes in `packages/cli/conformance/test-run-writes.test.ts`, k.ledger-items' in `packages/cli/conformance/ledger-items-runs.test.ts`. The fixtures are small projects under `packages/testing/conformance/fixtures/e2e/`: a node deployable with one store and one action, a `static` one, a two-`node` topology, a page whose click throws, a held-input island page, and a library folder. A case that needs a browser runs under `keel test --e2e` in its fixture as a child process, bounded at 60 s or more (docs/TESTING.md). The E1734 case runs with `playwright-core` absent from the fixture's resolution, not uninstalled from the repo.

## Migration
Each smoke becomes `*.e2e.ts` files in the project it tests, and CI's `built-smokes` job becomes `keel test --e2e` in each of them. `built.mjs`'s helpers then have no caller and are removed. `tooling/test-time.ts` stays for the repo's own tests.

| smoke | becomes | needs that the API lacks |
| --- | --- | --- |
| `persist.mjs` | `apps/golden-1/test/persist.e2e.ts`: add, reload, toggle, undo; `state(board)` in place of the SQLite read | none |
| `restart.mjs` | `apps/golden-1/test/restart.e2e.ts`: `fetch` writes, `stop`, `start`, `state(board)` equal | the store log's next id (head+1): asserted on `state` here, kept in k.persist conformance |
| `workflow.mjs` | `apps/golden-1/test/workflow.e2e.ts`: a copy with the planted step, `build(copy)`, `serve({ project })`, `until(removal, …)`, `stop` mid-step | the board log's contiguous ids, as above |
| `workflow-postgres.mjs` | the same file's second case, `env: { KEEL_DATABASE_URL: process.env.KEEL_TEST_POSTGRES_URL }`; CI gives a Postgres service | docker leaves the test: the URL is the environment's |
| `csp.mjs` | `apps/golden-1/test/csp.e2e.ts` and `examples/third-party-origin/test/csp.e2e.ts`: planted origins, `fetch` headers, nonces from the body | none; adds a browser case where `problems()` holds the blocked request |
| `dev-signin.mjs` | `apps/golden-2/test/dev.e2e.ts` with `serve({ dev: true })`: shells, stylesheets, sign-in by `page.fetch`, stubs, inspect, an edit and `serverLog` | none |
| `canary.mjs` | `apps/golden-2/test/canary.e2e.ts`: the sign-in flows, `serverLog`, headers, `dist/` and the data folder scanned with `node:fs`, `keel evidence` as a child | none |
| `brand.mjs` | `examples/static-client/test/brand.e2e.ts` on a fixture copy: `viewport`, `layout`, `press('Tab')`, `style` | the body's computed font: read on the page's root element |
| `inspector.mjs` | `apps/inspector/test/inspector.e2e.ts`: `serve()` of itself, `serve({ project: golden-1, dev: true, env: { KEEL_INSPECT_ORIGINS } })`, pages by id | none |
| `monitor.mjs` | `apps/golden-1/test/monitor.e2e.ts`: two contexts, `offline`, the conflict, `until` with `fixed: 60_000` for the merge, `keel session monitor` as a child | the caller cookie signed by hand: `env.KEEL_SECRET` given, the signed value computed in the test |
| `examples.mjs` | one `examples/<x>/test/<x>.e2e.ts` each: `answer` for the OpenAPI stub, `origins` for `api.github.com`, two `node` deployables for compose-peers, `build` after the codemod | none; the check, test and build loop stays in CI |
| `household.mjs` | `apps/household/test/*.e2e.ts`: sign-in, guards, cookies, `scripts: false`, forged origins by `fetch`, the outbox (worked case 2), conflict, sign-out elsewhere, `stop` with a write in flight, the weekly run | none |
| `resume.mjs` | `apps/golden-2/test/resume.e2e.ts`: `hold`, typing, `scroll`, `resume()`'s claim check, `requests()` for one POST, `viewport` and locale paths | none |
| `shell.mjs`, `shell-drive.mjs`, `shell-launch.mjs` | stay in `tooling/smoke/` | a native-shell driver (Tauri WebDriver, macOS accessibility, XCUITest), app launch and kill, the shell's store files |
| `shellReplay.mjs`, `webdriver.mjs` | stay, as the shell smokes' helpers | as above |

No migration notes: nothing is released.

## Cost
- **Install:** `playwright-core` is about 8 MB unpacked. Chromium headless shell is about 100 to 180 MB, downloaded once per machine by `playwright-core install chromium`. It is opt-in: an app with no e2e file installs none of it, and `@keel/testing` carries the peer as optional, so A1's install is unchanged.
- **Package size:** the `./e2e` entry is node-side only and adds nothing to any browser bundle. Its `size` budget is set when it is built.
- **CI time:** one `keel build` per project run, a browser start per file (about 1 s), and a server start per `serve` (0.5 to 2 s). The smokes today take a similar time, so moving them costs about the build each project already does. Two files run at once.
- **Flakiness, and how it is bounded:**
  - No sleeps. Every wait is on a browser event, a DOM change or a storage commit.
  - Event streams are left out of quiet, so a live page settles.
  - No retries, of a test or of a step. The only retry is a port the OS raced, at most three times.
  - Every bound is scaled by `KEEL_TEST_TIME_SCALE`, so a `0.1` run here finds the bounds a slow runner cuts. Inputs to the app are `fixed`.
  - Each test starts from fresh data and a fresh context.
  - The vitest watchdog kills a hung worker and its children.
  - The first failure prints its cause with the server's lines and a trace, so a flaky failure can be diagnosed from one run.
- **Process hygiene:** every process a `serve` starts is a child of the worker and dies with it, and every browser is closed at the file's end.

## Token impact
k.e2e is about 2,500 tokens and k.e2e-page about 1,850, each under the 3,100 section limit. k.test-run, k.ledger-items and k.cli grow by under 120 tokens together. The spec map stays at or under its 1,660 budget and `keel docs` at or under 1,690, through the trimmed titles (For the operator 6). No budget is raised.

## Build plan
- `@keel/testing`: the `./e2e` entry (`serve`, `answer`, `build`, and the `Served` and `Page` handles); the per-`serve` proxy and the shipped loopback certificate; quiet detection; the in-page a11y tree and axe; the resume claim check; `problems()`; traces and screenshots on failure; disposal through k.test-run's registry; `playwright-core` as an optional pinned peer; E1734 to E1738 registered with explanations.
- `@keel/cli`: `keel test --e2e` and `--engine`; `reports/tests/e2e.json`; `run.json`'s writer keeping `e2e.json`; the ledger's test-file pattern reading `*.e2e.*`; E1701 and E1705 over e2e files.
- `@keel/scaffold`: none in this RFC. A scaffolded `test/app.e2e.ts` and a CI step follow once the entry is built.
- Skills: `keel-testing` gains the e2e rung (verbs, waits, what does not reach a built app); `keel-deploy` points to `serve` for the variables.
- Apps and examples: the Migration table, then CI's `built-smokes` job rewritten as `keel test --e2e` per project.
