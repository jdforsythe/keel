# RFC 0244: end-to-end tests, `keel test --e2e` over the built app

Status: implemented (ADR-0267), the third part (The review's findings, below) included; the fifth part (The fourth part's review) is accepted and not yet built; that part accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Adds k.e2e, k.e2e-page and k.e2e-run (implemented). Amends k.server and k.contract (a loader's `site` and `host`, which the inspector's caller rule reads). Amends k.cli (the `test` row), k.test-run (Run report, one clause) and k.ledger-items (Run evidence, one clause), the map, `tooling/docs-owners.json` and the glossary (**end-to-end test**). New codes E1734 to E1738. From decision D187 (b) of task 0963 and the A2 end-user review (`tasks/p1/end-user-review.md`).

## For the operator
1. **`--e2e` runs the e2e files alone, not every rung.** Recommended. A7 asks for every rung from one command. `keel test` and `keel test --e2e` share one runner, one reporter, one report folder and one ledger, and the scaffolded CI runs both. Folding e2e into plain `keel test` would make every page-test run build the app and need a browser. To reverse, `keel test --all` runs both in order.
2. **`keel test --e2e` always builds.** Recommended: a stale `dist/` proves nothing about the code under test. The cost is one `keel build` per run (Cost). To reverse, add a `--built` flag that trusts `dist/`.
3. **No sim control reaches a built app.** Recommended, and stated in k.e2e Control. Playwright's fake browser clock is left out because the server's clock would not move with it.
4. **No `e2e:` ledger item kind for now.** Recommended. A passing e2e test is `example` evidence on the items it uses, like any test. A6 may later want "this route was opened in a real browser" as its own item. That can be added when an evidence reader asks for it.
5. **The shell smokes stay as tooling.** `shell.mjs`, `shell-drive.mjs` and `shell-launch.mjs` drive a Tauri binary, macOS accessibility and XCUITest. The page API here is a browser tab. A native-shell driver behind the same verbs is a follow-up RFC (Migration).
7. **`keel dev` listens on loopback by default; `keel dev --host <address>` is the one opt-in.** Decided with the operator. A person testing on a real phone over the local network is an ordinary need (A4; an iPhone has no `adb reverse`), and a wall there sends people to tunnels that are worse. The opt-in is a flag alone, so no environment value or committed file turns it on. It prints one W1569 naming the addresses, and its explanation lists what the network reaches: the source modules Vite serves, HMR, dev error texts, and whatever the app serves in dev, such as a dev sign-in fixture's fixed secret. `/__keel/inspect` still answers loopback connections alone, because it holds every store unredacted. An app's own dev fixtures are its own code, so Keel cannot fence them; the warning names them instead. `serve` in e2e and the inspector stay loopback, with no switch (k.topology #18 to #20, k.cli `dev` row).
8. **A production `node` deployable listens on every interface unless `HOST` says otherwise.** Recommended: a container's port mapping needs it, and an operator narrows it with `HOST`. The reverse, loopback by default, would break every Dockerfile Keel writes.
9. **The inspector trusts `Host` and `Sec-Fetch-Site`, with no token.** Recommended (The review's findings, 1). A token in the page cannot guard the first navigation, which is the one an attacker forges.
11. **`local: true` routes, not `site` and `host` on every loader.** Recommended (fourth part, 1).
12. **`--no-sandbox` exists, as a flag that warns on every run.** Recommended: a locked-down runner where the user cannot change a sysctl otherwise has no way through but running as root, which is worse.
10. **New verbs for upload, download, hover and opened tabs; no verb for drag, the clipboard or frames.** Recommended (finding 12).
6. **Map titles trimmed.** Recommended. The spec map had 17 tokens of room and `keel docs` had 1. Instead of raising either budget, map titles are shortened with no change of meaning: `Secrets, pii`, `Server deps`, `Surface compat`, `Library pack`, `Escape review`, `A11y`, `Proofs`, `Exploration`, and for the third part `Explain`, `Formats`, `Manifest`, `Contract`, and this RFC's own `Tests`, `Pages` and `Runner`. To reverse, restore the titles and re-base `spec.map` to 1,700 and `docs.map` to 1,730. At integration the lane merges `jdforsythe/test-impl`, whose two-level map (RFC 0246: a short top map plus area files under `spec/areas/`) replaces the one-level budgets this trimming served. This RFC's sections then take rows in the area files, and every shortened title returns to its full form: `Explain` to `Explanations`, `Formats` to `Format types`, `Manifest` to `Module manifest`, `Contract` to `Module contract`, `Tests` to `End-to-end tests`, `Pages` to `End-to-end pages`, `Runner` to `End-to-end runner`, and the second part's eight likewise. No budget is raised.

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
In a library's folder, `serve({ page: 'src/Card.ts', props })` writes a host project under `.keel/e2e-host/`: one `client` deployable whose one route renders the file's export (named as the file, one export per file) with `props`, inside the library's tokens. It builds that project and hosts it. `open('/')` then gives L1 a real-browser test of focus rings, `style`, `layout` at a `viewport` and axe, from the library's own folder, with no app.

`page` is a path, not the component object: the host is a generated project that imports the file, and an object does not say which file it came from. The host sits inside the library's folder so that it resolves packages from the library's own `node_modules`. It needs three kernel packages a library does not import: `@keel/compiler`, `@keel/router` and `@keel/server`. `keel scaffold library` lists them in `devDependencies`, with `@keel/testing`, `playwright-core` and a `test/<Name>.e2e.ts` for the scaffolded component. If one is missing, the result is E1737 naming it, with the fix. `keel pack` leaves `.keel/e2e-host/` out, and the scaffold's `.gitignore` lists it. A library whose parts need a server, such as L3's service libraries, is tested in an app that installs it (`examples/library-app` is the repo's).

The other shape considered was a host app the author writes under `test/`. It is a second project inside the package, with its own topology and a link back to the library, and every author would write the same one. The tool can write it from one path, so it does.

### Carrying every smoke's assertions
A migration loses no assertion. The first build of the page API could not express eleven checks the smokes made. Each is now carried, either by a verb or clause or by a check that already exists elsewhere:
- **Page titles** (`household.mjs`: `Household`, `Shopping list`). Carried by `title()` (k.e2e-page). A title is what a person and a screen reader see first, so an app's test should assert it.
- **An element's padding** (`frame.main`). `style` takes a closed list of names, and padding was not on it. Carried by adding `padding-top`, `padding-right`, `padding-bottom` and `padding-left`. The longhands are used because a shorthand's computed text differs by engine.
- **The brand's body background, font and colour.** `style` needs an id, and the `body` has none: Keel ids name app elements, and the document and its `body` are the framework's. Carried by `style(undefined, names)`, which reads the `body`, as `layout()` with no id reads the document. Ids stay the only selectors.
- **A caret set to a position before resume** (`resume.mjs` used `setSelectionRange(2, 2)`). Carried by placing the caret as a person does, with `focus`, `press('Home')` and `press('ArrowRight')`, after which `resume()`'s claim check holds it. There is no verb that sets a selection.
- **Console warnings** (`resume.mjs` refused warnings as well as errors). `problems()` held errors alone. Carried by adding the kind `warning`; an unread warning fails the test with E1738. A resume mismatch is reported as a warning, so leaving warnings out would hide exactly what `resume.mjs` looked for.
- **Island marks** (the served `data-k-island` values equal the live ones). Carried by `resume()`, which now rejects E1720 when the claim leaves other `data-k-island` values than the served document's. No verb reads raw HTML or the head: what a test needs from them is a check, so the check is built in.
- **A client-only API's preset cookies** (one cookie for the page's origin and one for the API's, so that "no cookie reaches the API" can fail). Carried by `open(path, { cookies })`. It is the one way to give a cookie a value, and nothing reads a value back.
- **A preflight, and a call refused by it.** `answer`'s `requests()` holds every request that reaches the origin, an `OPTIONS` preflight among them, so "two GETs and no preflight" is already asserted. The refused `x-keel` call showed that the stand-in applies CORS as a real API would. That is k.e2e's own claim, so it becomes a k.e2e clause, checked once in `@keel/testing`'s conformance with a fixture whose button sends the header.
- **A refused connect to an undeclared origin.** The browser enforcing the policy is checked by k.e2e's answered-origins clause, and that check reaches `problems()` as `csp`. The example checks its own policy text (`connect-src 'self' https://api.github.com`). Together they carry it.
- **The store log: ids rising by one to `head`, `head + 1` after a restart, `api.removal.restored` once, the step's effect `api.showList` once.** This RFC first moved these to k.persist conformance. No such clause exists: k.persist's conformance covers one process's `restore` and `commit`, not a SIGKILL between two processes. The check belongs to the app (a K7 developer asks whether a step's effect ran once across a crash), so it is carried by `log(store)` on `Served`: `{ head, entries }`, with each entry's id and name and no payload.
- **`monitor.mjs`'s tally merge.** After RFC 0248, `monitor` writes its counts to the archive's `tallies/` every 10 minutes and on shutdown, and `keel session monitor` sums the pulled files. The assertion becomes: after the two-user flow, `stop('api', { drain: true })` (SIGTERM; the server stops listening and awaits `close()`, k.deploy), then `keel session monitor` over the archive writes a `.keel/monitored.json` naming the board's transactions with `runs` of 1 or more. There is no 60 s wait. Until RFC 0248 merges, the e2e test reads `/sessions/tally` behind the reader guard, as the smoke did, with the reader cookie signed by the test's own `env.KEEL_SECRET`.
- **The household `/setup` part of `resume.mjs`.** Every step of it is now expressible: the hold and the typed name; the second client's run; the form posting once; Connecting after `stop()`; Live after `start()`; the run done after the restart; offline; and no warning or error. The steps after the submit move into `apps/household/test/resume.e2e.ts`.

Every browser smoke but the three shell ones is then deleted. A smoke stays, and CI runs it, until each of its assertions is carried.

### The inspector across origins
`apps/inspector` is a `client` deployable. Its loader calls `service({ base: url })` with `url` taken from the `?url=` search parameter, from the browser, to another origin's `/__keel/inspect`. Its built policy says `connect-src 'self'`, and that policy is right: an app cannot declare "any origin", and `origins` takes exact `https` origins only (E1590), so a dev server's loopback `http` origin cannot be declared at all. E1571 did not see the call because it reads a URL as written, and this base is computed at run time. The smoke passed only because its file server sent no `content-security-policy` header. The `csp.txt` the build wrote was never applied, so the smoke was passing for a reason that should not have worked.

What is right: the inspector reads the inspect document on its server, not in the browser. `apps/inspector` becomes a `node` deployable whose loader (`loadInspect.server.ts`, already server code by name) fetches `<url>/__keel/inspect`. The page then makes no cross-origin request, and `connect-src 'self'` holds unchanged. The dev app answers a GET with no `Origin` from a loopback `Host` (k.cli Inspect), so `KEEL_INSPECT_ORIGINS` is not needed. A server that fetches a URL a visitor typed could be turned against other hosts, so the loader accepts only a loopback target (`localhost`, `127.0.0.1`, `[::1]`) and answers any other with `inspector.unreachable` (`<url> is not on this machine`). The inspector is a tool for one's own dev server. Its e2e test serves itself, serves golden-1 with `dev: true`, opens `/?url=<golden-1's origin>`, and reads the panels by id. `tooling/smoke/inspector.mjs` is then deleted. What the target may be, who may call the loader and its one failure text: The review's findings, 1.

### The review's findings (third part)
A review attacked the second step's build. Each finding below gives the rule, the clauses that check it (section and position), and what the builder changes. "k.e2e-run" is a new section, which holds the runner's guarantees and the paragraphs k.e2e and k.e2e-page had no room for (Browser, Build input, Time, Ledger, Failure output).

1. **Dev-time servers listen on loopback; the inspector is not a request forwarder.**
   - Rule: every server Keel starts while developing or testing listens on loopback alone (k.topology Local topology, k.e2e-run Reach). Today `keel dev` takes Vite's `localhost` default, and a Vite `server.host` of `true` widens it. That is now E1560. The one way wider is `keel dev --host <address>`, with W1569 and `/__keel/inspect` kept to loopback connections (For the operator 7). A production `node` deployable listens on every interface unless `HOST` names an address (k.deploy). That is the spec's stated default, and it lives in k.deploy because k.hosting covers static hosts.
   - The inspector's loader rules:
     - It takes `?url=` only when that is an origin: http or https, a loopback host, no user, no path but `/`, no query, no fragment. It builds the request as `new URL(url).origin + '/__keel/inspect'`, so nothing of the caller's string survives.
     - It answers only a request whose `Host` is a loopback name with a port and whose `Sec-Fetch-Site` is `same-origin` or `none`. Any other request is 403 `keel.denied`, with nothing fetched.
     - That holds against a page on another origin: a cross-site navigation carries `cross-site`, and DNS rebinding carries a foreign `Host`. It also holds against another machine: the server listens on loopback under `keel dev` and `serve`, and a deployed copy still checks `Host`. A token in the page was rejected: the first navigation, the one an attacker forges, has no page to read it from.
     - Every fetch failure is one answer, `inspector.unreachable` `no inspect document at <origin>`. That covers a refused connection, a status, a timeout and a body that is not an inspect document, so the answer says nothing about what listens.
   - Clauses: k.topology #18 to #20, k.deploy #14, k.e2e-run #4. The inspector's rules are an app's, so they are checked by `apps/inspector/test/inspector.e2e.ts` and `loadInspect.test.ts`:
     - `?url=http://127.0.0.1:<p>/admin/delete-all%23` sends nothing to path `/admin/delete-all`;
     - a request with `Sec-Fetch-Site: cross-site`, or `Host: 192.168.1.5:<p>`, is 403 with no fetch made;
     - an `answer` on a free port and a closed port give the same text.
   - Builder: `@keel/cli` dev bind and E1560; `@keel/server` `start` reads `HOST`; `apps/inspector` loader and tests; the run's servers bind `127.0.0.1`.
2. **A migration loses no assertion, and each migrated assertion is proven red by a mutation.**
   - Rule: `problems(...expected)` takes only what an entry matches, so reading cannot hide an unexpected problem (k.e2e-page Verbs, Problems). `log(store)` gives `digest`, the SHA-256 of the stored snapshot's text, and each entry's payload `digest`. A restart can then be compared byte for byte without a value in the test's output (k.e2e Served).
   - Clauses: k.e2e #17, #18; k.e2e-page #11 (reworded), #17 (reworded), #20.
   - Lane rule: each row of the Migration table names a mutation of the app that turns its assertion red, and the build records that it did.
   - Builder: the weak rows below.
3. **`resume.mjs`'s last checks.**
   - The served-markup check is already expressible: `(await page.fetch(path)).text()` is the served document, sent with the context's cookies (k.e2e-page `fetch`).
   - `resume({ grows })` records each element under each island root once the document is parsed, before any script runs. After the claim, it rejects E1720 when a recorded element is gone or was replaced, or when an element was added under a root. Elements may be added inside an id named in `grows` and nowhere else, and a removal there is still E1720. The household's event list is named by its id. An element without an id is named by its tag and place.
   - Clauses: k.e2e-page #21, #22.
   - Then `resume.mjs` is deleted.
4. **Library hosts.**
   - Each `serve({ page })` writes its own `.keel/e2e-host-<random>/` and removes it at dispose. `wrap` (a component file under `test/` taking `children`) and `tokens` (a tokens file under `test/`) cover a surrounding layout and an app's restyling. A component needing route params, a guard or a server is tested in an app.
   - Clauses: k.e2e #21, #22.
5. **The browser.**
   - Chromium's sandbox is on, except on Linux as root (W1734). A fresh profile lives inside the run folder, never the developer's own, with no extensions.
   - Clauses: k.e2e-run #1, #2.
6. **Known ids.**
   - An id is known from `.keel/ids.json`, a form field of a listed form, a template id's head and tail, or the page right now. A listed id's prefix no longer makes an id known. An unknown id is E1705 at once with the nearest 3; only a known id that is not shown yet is waited for.
   - Clause: k.e2e-page #19.
7. **Paths in their folder.**
   - `page` is resolved and must lie under the library's `src/`; `wrap` and `tokens` must lie under `test/`. Anything else is E1736 naming the path.
   - Clause: k.e2e #23.
8. **Environment.**
   - Allowlist: `PATH`, `LANG`, `LC_ALL`, `TZ`, `SystemRoot`. `HOME`, `TMPDIR`, `TMP` and `TEMP` point into the data folder. Then come the runner's names, then `env`.
   - Clause: k.e2e-run #5.
9. **Reach and the certificate.**
   - A certificate is made per run for the mapped host names, and nothing is shipped. A page reaches only the served origins, the peer names and the mapped origins. Every other request, loopback ones among them, is refused before it leaves the browser and is a problem `offsite`, which E1738 fails unless the test takes it.
   - Clause: k.e2e-run #3.
10. **Teardown.**
    - The run folder `keel-e2e-<random>` holds everything the run makes, and `TMPDIR` points there for vitest. It is removed on every end, and on SIGINT with one `stopped:` line. A SIGKILLed run's folder is swept by a later run when it is older than 1 hour, names a dead process and is marked `.keel-e2e`.
    - Under the repo's `keelConfig` the run folder sits inside the vitest run's own root (`tooling/test-tmp-global.ts` points `TMPDIR` there first). An app outside the repo gets the same containment from `keel test --e2e` itself.
    - Clauses: k.e2e-run #6, #7.
11. **Unexpected errors.**
    - A non-Keel error is the test's T0001 `uncaught: <code> <first line>`, never under `fix:`.
    - Clause: k.e2e-run #8.
12. **Walls.**
    - New verbs: `upload`, `download`, `hover`, `opened()`, and the `dialog` problem kind. A drag is tested through its keyboard path, a copy by the text it holds, a paste by typing, and a frame by its own `serve`. E1705 names the frame case. One line in the keel-testing skill says so.
    - Clauses: k.e2e-page #23 to #26.
13. **CI cost.**
    - Build plan only.

### Two surfaces the build added (fourth part)
1. **Local routes instead of `site` and `host` on every loader.**
   - What was built: the inspector's caller rule widened every loader with `site` (`Sec-Fetch-Site`) and `host` (`Host`). That gives every app a general way to make decisions on raw headers. An author behind a proxy would treat `Host` as trusted, and neither header is a boundary alone.
   - Decision: the loader is not widened. A page or API entry declares `local: true` (k.contract Local routes), and the server enforces it before guards, loaders or actions run. It requires three things: a loopback remote address, a loopback `Host` with a port, and `Sec-Fetch-Site` `same-origin` or `none`. Any other request is 403 `keel.denied`.
   - Why it is better for A2: one declared member, not header logic in each app. For A8: the surface (`routes.json`) shows which routes answer this machine alone, and the remote-address check holds where `Host` is forged. Any dev tool can reuse it.
   - Clauses: k.contract Local routes and Conformance, the last five bullets; k.server's loader bullet and k.contract Binding list no `site` or `host`.
   - Builder:
     - remove `site` and `host` from `@keel/server` and `@keel/router`'s loader argument;
     - pass the connection's remote address from `start` to `createApp`;
     - enforce `local`, and write it into `routes.json`;
     - `apps/inspector`: `local: true` on `inspector.index`, the loader's header checks deleted.
2. **The sandbox.**
   - When Chromium cannot start its sandbox, the run fails with E1734 before any file. The fix text names `kernel.apparmor_restrict_unprivileged_userns=0`, `kernel.unprivileged_userns_clone=1`, a seccomp profile allowing `CLONE_NEWUSER`, and `--no-sandbox`.
   - `--no-sandbox` is the one explicit acceptance: a flag only, with W1734 on every run. Root on Linux runs unsandboxed with W1734 on every run.
   - The seam is `KEEL_E2E_SANDBOX=unavailable`. It makes the check fail without launching, and no value turns the sandbox off.
   - Clauses: k.e2e-run Browser and its last three bullets; k.e2e Files names the flag.
   - The repo's CI runs `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` on its Ubuntu runners. That is acceptable there for three reasons: the runner is a single-use VM; the setting restores what the kernel allowed before Ubuntu 23.10; and it keeps the sandbox on rather than taking `--no-sandbox`.
   - Builder: the `--no-sandbox` flag and W1734 for it, the seam, and the fix text.
   - Conformance-writer: the new bullets, using the seam.

### The fourth part's review (fifth part)
A review of the fourth part's build found the design holds on a `node` deployable's own socket, and five gaps around it. Each is closed in the spec; none accepts a security declaration that does nothing.
1. **`local: true` outside a `node` deployable.** A `client` deployable built clean with a `local` page, and its loader's content shipped in `dist/web`. Now E1511, which already refuses an API entry there for the same reason (no server to answer or enforce it): message `<id>: local route in <adapter> deployable <name>, which has no server`, no fix, the remedy `keel explain`'s. Clauses: k.api Rules; k.contract Local routes and its last bullet.
2. **Peer forwarding.** A `local` page answered 403 from the LAN directly and 200 through `examples/compose-peers`' forwarding `web`, whose own loopback connection to the peer passed the check. A deployable now never forwards a request for a route the peer's `routes.json` marks `local`, and answers 403 `keel.denied` itself. Local routes says Keel's forwarding is covered and an outside proxy is the operator's. Clauses: k.topology Calls and peers and its last bullet.
3. **Headers on every refusal.** `server.mjs`'s `host refused` 403 is answered before `createApp`, so it carried none of the k.security headers. Every refusal now carries them. Clauses: k.security Headers; k.contract's second-last bullet.
4. **No `Host`.** An HTTP/1.0 request with no `Host` was 400; it is 403 `keel.denied`, as a `Host` that cannot be read is. Clause: k.contract's second-last bullet.
5. **E1734's fix as written.** The seccomp-profile route alone left a CI user without a flag to type. The fix text now lists, safest first: the host sysctls, a seccomp profile allowing `CLONE_NEWUSER`, `docker run --security-opt seccomp=unconfined` (which lifts every syscall filter from the container), and `--no-sandbox` with W1734 last. Clauses: k.e2e-run Browser and its last bullet.
6. **Skills.** keel-server gains a line on `local: true` and one on a harness `fetch` with no connection, held at its 2,900-token target by trimming prose. keel-testing stays at its 3,700-token ceiling.
- Builder: E1511 for `local` entries in `apiWithoutServer` and `selectDeployable`, with its explanation; the forwarding check in `createApp` before `forward`; `start`'s error handler answering a missing or unreadable `Host` 403 through the k.security headers; the E1734 fix text in `sandboxCheck`. Under `keel dev`, a `local` route of a second `node` deployable is reached through that deployable's own `createApp` with the connection, or the rule refuses it there too: the builder confirms which, and reports it.
- Conformance-writer: the four new bullets (Conformance diff).

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
- New `spec/kernel/k.e2e.md` (proposed): Files, Build input, Browser, serve, Served, Answered origins, Isolation, Libraries, Control, Time, Ledger, Rules, and 19 clauses: the second part adds `open`'s `cookies`, `log`, `stop`'s `drain`, Libraries as a host project, and the CORS preflight clause, and the answered-origin clause's `answer` gains `access-control-allow-origin: *`.
- New `spec/kernel/k.e2e-page.md` (proposed): open, Verbs, Waits, Problems, Failure output, Rules, and 18 clauses: the second part adds `title()`, padding and the `body` to `style`, `warning` problems and the island check of `resume()`.
- k.cli: the `test` row reads `test [paths] [--e2e]`, harness under sim ctx; `--e2e`, the built app in a browser (k.e2e).
- k.test-run Run report: without `shard`, `writeTestReport` removes the folder's other files but `e2e.json`. One clause.
- k.ledger-items Run evidence: what a test file is (`.test.` or `.spec.` before a script extension, or an e2e file). One clause.
- Made exact while building: a verb's id is refused (E1705) when it is not in `.keel/ids.json`, not `<id>.<key>` under one of its ids, not under a template id's fixed head or tail the project's or its libraries' source writes, and not a form field's `<formId>:<path>`; `find` gives `value` as k.testing's does, but a host element's, which lives in the runtime; `focusOrder()` is a page verb; a held page's parked scripts are not waited on; the held-page clause reads the caret with `press('x')` and the input's `value`; the cookie clause's cookie is the caller cookie a form POST mints; the problem clause's handler rejects with `Error('boom')` (app code may not `throw`); an artifact is `<file>-<line>-<n>`, `<file>` less its `.ts`, `<line>` the T0001's; the defaults (10 s a wait, 20 s a start, 60 s a test) are fixed time and only `within` scales (docs/TESTING.md Time scale), so the timeout clause reads 60 s at scale 0.1.
- Third part:
  - New `spec/kernel/k.e2e-run.md` (proposed). It holds Browser, Build input, Time and Ledger (moved from k.e2e), Reach, Environment, Teardown, Failure output (moved from k.e2e-page), Walls, Output, Rules (W1734), and 8 clauses.
  - k.e2e: its Libraries paragraph is rewritten, `log` gains digests, the env comes from k.e2e-run, `HOST` is set, and E1736 covers paths. 23 clauses: #17 reworded, #18 and #21 to #23 new.
  - k.e2e-page:
    - The known-id rule replaces the "made exact" sentence above: an id under a listed id is no longer known for that alone.
    - Adds `problems(...expected)`, `resume({ grows })`, `upload`, `download`, `hover`, `opened()` and the `dialog` and `offsite` kinds.
    - Clauses: 26; #11 and #17 are reworded, and #19 to #26 are new.
  - k.deploy: `HOST`, and the default of every interface; #14 new.
  - k.topology: `keel dev` on loopback, with E1560 for a wider `server.host`, and `--host <address>` as the one opt-in. With it comes W1569, and `/__keel/inspect` stays loopback-only. #18 to #20 new.
  - k.cli: the `dev` row gains `[--host A]`.
  - Map: row `k.e2e-run`, and more titles shortened (For the operator 6).
  - `tooling/docs-owners.json`: k.e2e-run owned by `@keel/testing`.
  - The keel-testing skill: the new verbs and the walls line, held at its 3,700-token target.
- Fifth part:
  - k.contract Local routes: a missing or unreadable `Host` is 403 `keel.denied`; every refusal carries the k.security headers; Keel's forwarding is covered and an outside proxy is the operator's; `local: true` outside a `node` deployable is E1511. Rules point to E1511. Two bullets new, at the end.
  - k.api Rules: E1511 covers a `local: true` entry, with both messages, `keel build` failing, and no fix.
  - k.topology Calls and peers: a peer's `local` route is never forwarded; one bullet new, at the end.
  - k.security Headers: refusals `server.mjs` answers before `createApp` carry the headers.
  - k.e2e-run Browser: E1734's fix text, safest first, with `--security-opt seccomp=unconfined`; one bullet new, at the end.
  - The keel-server skill: two lines, held at its 2,900-token target.
- Map: rows `k.e2e` and `k.e2e-page`, `k.e2e` added to the E170x block, and eight titles shortened (For the operator 6). `tooling/docs-owners.json`: both sections owned by `@keel/testing`. Glossary: **end-to-end test**.

## Conformance diff
The conformance-writer covers k.e2e's 23, k.e2e-page's 26 and k.e2e-run's 8 clauses, k.deploy #14 and k.topology #18 to #20, k.test-run's new clause and k.ledger-items' new clause, citing each word for word. Proposed files: `packages/cli/conformance/e2e-command.test.ts` (k.e2e clauses on `keel test --e2e`, E1734, E1736, the report files, time); in `packages/testing/conformance/`, `e2e-serve.test.ts` (serve, peers, static, E1737, isolation, stop and start, `until`, answered origins), `e2e-page.test.ts` (verbs, waits, E1705, E1735, hold and resume, offline, cookies, documents, style), `e2e-failure.test.ts` (E1738, the T0001 output, `reports/e2e/`, a11y E1703). k.test-run's clause goes in `packages/cli/conformance/test-run-writes.test.ts`, k.ledger-items' in `packages/cli/conformance/ledger-items-runs.test.ts`. The fixtures are small projects under `packages/testing/conformance/fixtures/e2e/`: a node deployable with one store and one action, a `static` one, a two-`node` topology, a page whose click throws, a held-input island page, and a library folder. A case that needs a browser runs under `keel test --e2e` in its fixture as a child process, bounded at 60 s or more (docs/TESTING.md). The E1734 case runs with `playwright-core` absent from the fixture's resolution, not uninstalled from the repo.

The fifth part adds four clauses, each at the end of its section:
- k.contract: `server.mjs` of a `keel build` fixture answers an HTTP/1.0 `GET /` with no `Host`, a `GET /` with `Host: [::ffff:127.0.0.1]:<port>`, and a `GET` of its `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: cross-site`, each 403 `keel.denied` carrying the six k.security headers.
- k.contract: In a fixture whose `client` deployable `web` serves module `a` with a `local: true` page `a.tools`, `keel check` and `keel build` each report one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, `keel build` exits 1 and writes no `dist/web/`, and `createApp` for `web` throws E1511; with `web` a `static` deployable, one E1511 `a.tools: local route in static deployable web, which has no server`; with `a` served by a `node` deployable, none.
- k.topology: With `x` forwarding to `y` and `y`'s `routes.json` marking page `b.tools` at `/tools` `local: true`, a `GET /tools` to `x` from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers 403 `keel.denied` carrying the six k.security headers, and `y` receives no request.
- k.e2e-run: In that E1734's fix text `kernel.apparmor_restrict_unprivileged_userns` comes before `CLONE_NEWUSER`, `CLONE_NEWUSER` before `--security-opt seccomp=unconfined`, and `--security-opt seccomp=unconfined` before `--no-sandbox`.
- k.security Headers is widened with no new bullet: the k.contract bullet above checks the refusals it names.

Proposed files: k.contract's two in `packages/server/conformance/` beside the local-route cases (the `server.mjs` one) and `packages/check/conformance/` (E1511); k.topology's in `packages/server/conformance/`; k.e2e-run's in `packages/cli/conformance/` beside the sandbox cases.

The builder disputed seven points in the first fixtures. One was a spec sentence: the answered-origin clause's `answer` returned no `access-control-allow-origin`, so the page's cross-origin call would fail CORS before it could be "received". The clause now states the header. The other six are fixture errors the conformance-writer corrects from the spec text as it stands:
- the fixture project links no `@types/node`, so its build is E1751;
- `fixtures/e2e/node-app.ts` fails `keel check` 34 times;
- a store made at module scope is E1203;
- the held-input case reads `text`, where k.e2e-page's clause says `value`;
- the cookie case uses a GET, where the clause names a form POST, the page's first write;
- an item id is not of a form E1705 admits (`<id>.<key>` under a listed id, or a template id's head).

## Migration
Each smoke becomes `*.e2e.ts` files in the project it tests, and CI's `built-smokes` job becomes `keel test --e2e` in each of them. `built.mjs` stays as the shell smokes' helper. `tooling/test-time.ts` stays for the repo's own tests.

| smoke | becomes | needs that the API lacks |
| --- | --- | --- |
| `persist.mjs` | `apps/golden-1/test/persist.e2e.ts`: add, reload, toggle, undo; `state(board)` in place of the SQLite read; after the first reload `expect(await page.findAll('todos.listLink')).toHaveLength(1)` (mutation: the list rendered twice; proven by mutation: `ListsPage.tsx` rendering each `todos.listLink` twice fails it, 2 links not 1) | none |
| `restart.mjs` | `apps/golden-1/test/restart.e2e.ts`: `fetch` writes, `stop`, `start`; `expect((await app.log(board)).digest).toBe(before.digest)` for the stored row byte for byte, and each entry's `digest` equal (mutation: restore re-encodes the snapshot; proven by mutation: the api's start writing `keel.store.api.board` back as `JSON.stringify(value, null, 1)` fails the `digest` line) | none: `log(board)` gives the digests and the next id (`head + 1`) |
| `workflow.mjs` | `apps/golden-1/test/workflow.e2e.ts`: a copy with the planted step, `build(copy)`, `serve({ project })`, `until(removal, …)`, `stop` mid-step; the kept instance within the smoke's 10 s, `{ fixed: 5_000, within: 5_000 }` from the restart (mutation: the step retried after a 20 s back-off; proven by mutation: a resumed step waiting `ctx.clock.after(20_000)` in `stepJob.server.ts` fails the SQLite case with E1735 at that `until`) | none: `log(removal)` and `log(board)` give the attempts, `restored` once and `api.showList` once |
| `workflow-postgres.mjs` | the same file's second case, `env: { KEEL_DATABASE_URL: process.env.KEEL_TEST_POSTGRES_URL }`; CI gives a Postgres service | docker leaves the test: the URL is the environment's |
| `csp.mjs` | `apps/golden-1/test/csp.e2e.ts` and `examples/third-party-origin/test/csp.e2e.ts`: planted origins, `fetch` headers, nonces from the body | none; adds a browser case where `problems()` holds the blocked request |
| `dev-signin.mjs` | `apps/golden-2/test/dev.e2e.ts` with `serve({ dev: true })`: shells, stylesheets, sign-in by `page.fetch`, stubs, inspect, an edit and `serverLog` | none |
| `canary.mjs` | `apps/golden-2/test/canary.e2e.ts`: the sign-in flows, `serverLog`, headers, `dist/` and the data folder scanned with `node:fs`, `keel evidence` as a child | none |
| `brand.mjs` | `examples/static-client/test/brand.e2e.ts` on a fixture copy: `viewport`, `layout`, `press('Tab')`, `style` | none: `style(undefined, …)` reads the `body` |
| `inspector.mjs` | `apps/inspector/test/inspector.e2e.ts`: `serve()` of itself as a `node` deployable, `serve({ project: golden-1, dev: true })`, pages by id; `expect(count).toMatch(/^Log: [1-9]\d* entries$/)` and the number of `inspector.store.todos.outbox.entry.*` equal to it (mutation: the view always prints `Log empty: nothing to undo`; proven by mutation: that text in `StoresView.tsx` fails the count line); the caller rule's three cases (finding 1) | the inspector reading on its server (The inspector across origins) |
| `monitor.mjs` | `apps/golden-1/test/monitor.e2e.ts`: two contexts, `offline`, the conflict, `stop('api', { drain: true })`, then `keel session monitor` as a child; the offline failures taken by `u1.problems({ kind: 'console', text: 'ERR_INTERNET_DISCONNECTED' })` and nothing else, so a detached rejection fails E1738 (mutation: a rejection added to `resolveEdit.ts`; proven by mutation: `void Promise.reject(new Error('mutant rejection'))` there leaves a `pageerror` the bare read after the taken console errors shows, and the test fails) | the caller cookie signed by hand: `env.KEEL_SECRET` given, the signed value computed in the test |
| `examples.mjs` | one `examples/<x>/test/<x>.e2e.ts` each: `answer` for the OpenAPI stub, `origins` for `api.github.com`, two `node` deployables for compose-peers, `build` after the codemod | none; the check, test and build loop stays in CI |
| `household.mjs` | `apps/household/test/*.e2e.ts`: sign-in, guards, cookies, `scripts: false`, forged origins by `fetch`, the outbox (worked case 2), conflict, sign-out elsewhere, `stop` with a write in flight, the weekly run; in `durable.e2e.ts` the kept name by equality, `expect(JSON.parse(named).name).toBe('Oak Road')` (mutation: the name saved as `Oak Road ` with a space; proven by mutation: the setup transaction saving `name + ' '` fails the equality) | none |
| `resume.mjs` | `apps/golden-2/test/resume.e2e.ts`: `hold`, typing, `scroll`, `resume()`'s claim check, `requests()` for one POST, `viewport`, locale paths, `warning` problems; household's `/setup` steps in `apps/household/test/resume.e2e.ts` | none |
| `shell.mjs`, `shell-drive.mjs`, `shell-launch.mjs` | stay in `tooling/smoke/` | a native-shell driver (Tauri WebDriver, macOS accessibility, XCUITest), app launch and kill, the shell's store files |
| `shellReplay.mjs`, `webdriver.mjs` | stay, as the shell smokes' helpers | as above |

### Where each assertion went
Every assertion of each deleted smoke, the file that now makes it and the test (`it`) that holds it.

| old smoke | assertion | file | test |
| --- | --- | --- | --- |
| `persist.mjs` | a list made, found after a reload; a todo added, found after a reload; toggle and undo, each answered 200 and kept after a reload; the board row holds both; no page or console error | `apps/golden-1/test/persist.e2e.ts` | a list and a todo survive reloads, a toggle and its undo reach the api, and the board row holds them |
| `restart.mjs` | five writes answered 200; the stored board equal before and after a SIGKILL and restart; the GET equal; log ids rising by one to `head`; the next write `head + 1` and the only new entry | `apps/golden-1/test/restart.e2e.ts` | the board stored before a SIGKILL is the board after the restart, and the next write applies |
| `workflow.mjs` | the planted step running, a SIGKILL inside it, the instance ending `kept`; `api.removal.attempt` twice, `api.removal.restored` once and absent mid-run; `api.showList` once; board log ids contiguous to `head`; the list shown once | `apps/golden-1/test/workflow.e2e.ts` | the SQLite case |
| `workflow-postgres.mjs` | the same on Postgres 17 (`KEEL_TEST_POSTGRES_URL`, a clear failure when unset) | `apps/golden-1/test/workflow.e2e.ts` | the Postgres case |
| `csp.mjs` | the client's `csp.txt` with its origins and not the host's, `script-src 'self'`, no nonce; the api's document and client-path policy equal to it; a JSON route's `default-src 'none'; frame-ancestors 'none'`; the example's policy, a 64-character nonce equal to the module script's, declared origins only, a new nonce per document | `apps/golden-1/test/csp.e2e.ts`, `examples/third-party-origin/test/csp.e2e.ts` | each file's first case; the example's second case adds the browser's `csp` problem for an undeclared image |
| `dev-signin.mjs` | the shells, the accounts page, `GET /api/me` 403, sign-up and sign-in 303 with and without the session cookie, the page naming the account, the server-only stubs with no `node:` import, an edit reaching the server | `apps/golden-2/test/dev.e2e.ts` | its one case |
| `canary.mjs` | every canary absent from the log (json and compact runs), error answers, redirects, URLs, cookies, `dist/`, the data folder and the evidence bundle; `keel evidence --verify` over golden-2 and household; the carried checks (`/api/me`, the database) | `apps/golden-2/test/canary.e2e.ts` | the cases of "canaries in the sinks of the served api", "no canary is in the build artifacts under dist/" and "the evidence bundle holds no canary" |
| `brand.mjs` | the body's background, font and colour; the focus ring per Tab stop; the responsive row at each viewport | `examples/static-client/test/brand.e2e.ts` | the brand's reset, focus ring and responsive Box hold in Chromium |
| `brand.mjs` | the k.values Stylesheet invariant (`cssKept.mjs`): every rule the compiler emits from token values kept in Chromium with each declaration, the grammar's edge cases refused or in effect, each attack value refused before emission | `tooling/smoke/values.mjs`: it needs a parser of the browser, not an app, so no page by Keel id can make it | its seven steps |
| `inspector.mjs` | a list added in golden-1 reported; the inspector live, with the graph grouped by kind and its counts, the `todos.outbox` store with `outbox.add` in its log, the ids view; no inspector error; no page error on either page | `apps/inspector/test/inspector.e2e.ts` | its one case |
| `monitor.mjs` | the build with a fresh reader; the two-user board script; one tally merge read at `/sessions/tally` behind the reader guard; `keel session monitor` writing `monitored.json` (`v`, `origin`, `tx`, `from` <= `to`); SIGTERM at the end | `apps/golden-1/test/monitor.e2e.ts` | its one case (`stop('api', { drain: true })`) |
| `examples.mjs` | per example its proof: the OpenAPI stub's one request (openapi-import), the client-only API's two GETs with no preflight and no cookie reaching it with both cookies preset, its policy text and E1571 without the origin (client-only-api), the peer greeting, the refused forged header and compose's peer (compose-peers), the codemod's tree checking, testing, building, showing the peer count and restoring byte for byte (codemod-place), the empty Host node drawn into (host-component, library-app), the links-in shell build and route, the shell mount sign-in (shell-mount), the native shells' ids and Keel-free web builds, the static client under a plain host | the e2e file in each example | each file's case(s); the per-example check, test and build loop is CI's |
| `examples.mjs` | library-looks: a `./tokens` entry whose first condition is `keel` (`./src/acmeTokens.ts`) and the ledger listing `Badge`, `Card`, `Switch`, `Toggle` | `examples/library-looks/test/package.test.ts` | ships its look |
| `household.mjs` | the start page's stylesheet, the guard to `/signin?next=%2Flist`, sign-up and sign-in to `/list`; the session cookie's flags; setup, the brand serif, the menu through a reload; the API refusing a stranger and a forged origin; receipts, a rejected form keeping its values (scripts on and off); tokens minted and revoked; the pii canary; a kill with a write in flight on PGlite; Postgres 17; the outbox offline, the conflict, sign-out elsewhere; reconnect after a restart; the weekly run | `apps/household/test/access.e2e.ts`, `durable.e2e.ts`, `pii.e2e.ts`, `postgres.e2e.ts`, `outbox.e2e.ts`, `reconnect.e2e.ts`, `restock.e2e.ts` | the case named for each flow |
| `resume.mjs` | golden-2's pages resumed in place with rows, scroll, typed value, caret and focus kept, island marks equal, no warning or error, one interaction each; the early submit posting once; sign-up and sign-in posting once with a 303; the api restart; the 390px catalog in two locales; household's `/setup` held, typed, resumed and live through a kill and offline | `apps/golden-2/test/resume.e2e.ts`, `apps/household/test/resume.e2e.ts` | the cases listed in each file |
| `household.mjs` | the page titles `Household` and `Shopping list`; the receipts frame's padding | `apps/household/test/access.e2e.ts` | the start-page case; the setup action writes the name, the frame sets the brand serif, and the list takes the menu and keeps it through a reload |


`resume.mjs` is deleted, with its CI step: its count of removed served elements, those without an id among them, and of elements added under an island root is `resume()`'s check (k.e2e-page #21, #22), with the household's event list named in `grows` (`apps/household/test/resume.e2e.ts`, `resume({ grows: ['app.recording.events'] })`); its served-markup checks read the served document: golden-2's (`id="recipes.shell"`, `<!--[-->`, `id="recipes.new"` with `name="title"`, `id="recipes.catalog"`, `id="accounts.signin"`) through `Served` `fetch` in `apps/golden-2/test/resume.e2e.ts`, the household setup page's (the `setup.form` island, `id="setup.page"`, the live panel saying Connecting) through the signed-in page's `(await page.fetch('/setup')).text()`.

The lane's rule: a migrated assertion is proven by a mutation that turns it red. The table names the mutation for each row the review found weak, and the build records, per row, that the mutation made its test fail.

Two checks the smokes made in the page are carried by the conformance instead, as above: the `x-keel` call a stand-in refuses (k.e2e's preflight clause) and the refused connect to an undeclared origin (k.e2e's answered-origins clause, with the example's policy text).

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
- The third part: k.e2e-run (sandbox, fresh profile, the per-run certificate, refusing offsite requests, the environment allowlist, the run folder and its sweep, uncaught output), `HOST` in `@keel/server`'s `start`, `keel dev` on loopback with E1560, `keel dev --host` with W1569 (registered with its explanation) and `/__keel/inspect` judged by the connection's remote address under it, `problems(...expected)`, `log` digests, `resume({ grows })`, `upload`, `download`, `hover`, `opened()`, the `dialog` kind, the known-id rule, library hosts per call with `wrap` and `tokens`, and the inspector's loader rules.
- CI: only the shards that run e2e files install Chromium (today two of seven), and they restore it from a cache keyed by the `playwright-core` version, so a shard with no e2e file downloads no browser.
