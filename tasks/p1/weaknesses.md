# P1 weakness triage

The triage of every unchecked line of `tasks/BACKLOG.md` on 2026-11-19 (W2 steps 1 and 2 of `tasks/p1/PLAN.md`), under the definition recommended in decision O1: a weakness is any line tagged high, medium, red-team or security, any a11y or privacy gap, any missing conformance, and any low line where a user's data, a user's access or a false claim is at stake. The operator confirms this list once (O1).

Each unchecked backlog line appears in exactly one of the four lists below.

| List | Lines |
| --- | --- |
| 1 Weaknesses, fixed in P1 | 128 |
| 2 Docs sweep (W12 step 4) | 29 |
| 3 Feature ideas for `tasks/FUTURE.md` | 7 |
| 4 Other | 131 |
| Total | 295 |

Verify the counts and that no id appears twice or goes missing:

```sh
diff <(grep '^- \[ \]' tasks/BACKLOG.md | cut -c7-10 | sort) \
     <(grep -E '^- \[[ x]\] [0-9]{4} ' tasks/p1/weaknesses.md | cut -c7-10 | sort) && echo same
for s in 1 2 3 4; do awk -v s="$s" '/^## /{n=substr($2,1,1)} n==s && /^- \[[ x]\] [0-9]{4} /' tasks/p1/weaknesses.md | wc -l; done
```

Rules applied:
- A defect where Keel does other than its spec or a page says is a false claim and a weakness when a user's data, access or safety, or a security, privacy or a11y statement, rests on it. A checker rule that misses a case is a weakness when the rule guards privacy, security or a11y; a miss in any other rule is 1.0 completion work (list 4).
- A gap in `docs/THREAT-MODEL.md` or in the k.privacy and k.security text is a weakness, since the outside reviews (W4) read those documents; any other spec or docs correction is sweep work.
- No kernel or std feature is cut from 1.0: a line that finishes a 1.0 feature goes to list 4 as 1.0 completion work, never to list 3.
- Lines in flight today are marked `in flight` and belong to no fix lane.

## 1 Weaknesses, fixed in P1

Sizes: S fits in an hour, M in half a context window, L in a whole one. The lane is the fix lane below.

### Security and privacy

- [x] 0501 std-offline · M · a stored outbox entry posts to its stored `origin` unchecked and to the next signed-in user's caller; build RFC 0120 · lane 01
- [x] 0509 std-offline · M · the outbox sends through `service({ module })`, `send` takes no origin and entries carry none (RFC 0120, with 0501) · lane 01
- [x] 0797 std-offline · S · red-team: the flush's retry timer outlives `drain`'s scope and still posts · lane 01
- [x] 0798 std-offline · S · red-team: an `events: true` endpoint in an outbox leaves its entry `sending` across reloads · lane 01
- [x] 0799 std-offline · S · red-team: two ctxs over one module-level outbox fail each other's entries · lane 01
- [ ] 0800 std-offline · S · red-team: two tabs overwrite each other's stored outbox, so a reload loses the other tab's queued writes · lane 01
- [x] 0945 std-offline, std-channels · S · confirm with a test that the 0501 and 0478 fixes are built, then close both · lane 01
- [x] 0478 std-channels · S · every cookieless caller shares one `perCaller` allowance; build RFC 0121 · lane 01
- [x] 0777 std-channels · S · red-team: the bounds read the opener module's config but count every module's sinks · lane 01
- [x] 0441 server · S · an input that becomes `type="password"` only in the browser keeps its value in `#k-state` · lane 02
- [ ] 0442 server · S · plain siblings of an `s.secret` under an array, record or union drop from a 422 re-render (server budget) · lane 02
- [x] 0671 server · S · another package replacing or clearing the `onSecret` slot leaves a running app unscrubbed · lane 02
- [x] 0683 server · M · copies of a secret in other encodings (`+`, `encodeURI`, double encoding, JSON `\u`) are not scrubbed · lane 02
- [x] 0722 server · S · the dev body of a component that throws while rendering is clipped and not scrubbed · lane 02
- [ ] 0729 server · S · red-team: the scrub costs about 1.2 s of event-loop time on a 790 KB body of secret items · lane 02
- [x] 0737 server · S · red-team: some 404 path shapes (`;jsessionid`, `%20`, homoglyphs, `&code=`) are written raw · lane 02
- [ ] 0756 server · S · a secret beginning or ending with `/` leaves that slash beside `[secret]` in the `req` log line · lane 02
- [ ] 0894 router · S · red-team: `identityMount` does not validate `path` at runtime, so `/\evil.example` resolves off-origin · lane 03
- [ ] 0893 compiler, router · S · red-team: E1579 misses a param route matching `handle.path`, and the client router swallows mount links · lane 03
- [ ] 0895 compiler · S · red-team: a `handle.path` of `/assets` shadows built assets and E1579 allows it · lane 03
- [ ] 0336 router, testing, std-messages, forms · M · red-team leads: `navigate` with `\` gives an off-origin `//x`; `settle` spins on a sim clock; direct locale imports are unparsed; `issueText` gets user-chosen keys · lane 03
- [ ] 0503 server, std-channels · M · one stream pool for every live loader lets one client starve every channel subscriber; THREAT-MODEL and std.channels say nothing caps streams · lane 04
- [ ] 0364 server · S · the per-deployable cap on concurrent event streams is unconfirmed (low, suspected); settle with 0503 · lane 04
- [ ] 0350 server · S · an outside request carrying `x-keel-forwarded` gets 404 instead of a forward; a loop guard only, or signed from `KEEL_SECRET` · lane 04
- [ ] 0569 server · S · client `.map` files a Vite config turns on are served from `assets/` · lane 04
- [ ] 0415 server · S · a GET to an API route with no loader answers 405 before its guards run, with no body · lane 04
- [ ] 0274 server, apps/sessions · S · W1557 (`secure` not set) fires behind a proxy and the sessions app has no switch for `secure: true` · lane 04
- [ ] 0865 tooling, server · S · no built `server.mjs` with an `identity.server.ts` has run; add it to the built smokes · lane 04
- [ ] 0733 check · S · E1111 reads a schema object changed after its literal as clean · lane 05
- [ ] 0831 check · S · E1303 misses `reveal` in helpers, re-exported reducers and `export { reveal as open }` · lane 05
- [ ] 0856 check · S · k.security says E1571 decides by E1004's reachability; the rule decides by filename only · lane 05
- [ ] 0880 check · S · E1107 keeps its own client reach instead of the shared one · lane 05
- [ ] 0884 check · S · `/// <reference types="vite/client" />` passes `keel check` though only Node's ambient types are allowed · lane 05
- [ ] 0519 check · S · E1567 misses a namespace import of `@keel/services` (budget at 18 B over) · lane 05
- [ ] 0386 compiler, check, apps/golden-1 · M · a `.server.ts` loader in a `client` deployable runs in the browser; golden-1's smaller hand-build items with it · lane 06
- [ ] 0521 compiler · S · `stdRoutes.ts` reads a stdlib manifest by path, so a published std package serves no routes · lane 06
- [ ] 0517 cli · M · `surfaceRun` drops a `routes.ts` that throws, so `keel build` exits 0 and E1562 can pass a break (needs a design) · lane 06
- [ ] 0261 store, schema · M · red-team: a spread copies an `s.secret` payload into open-object state, so live state holds a secret that `snapshot()` drops · lane 07
- [ ] 0595 schema · S · a marked open object's undeclared keys have no `piiPaths` entry though `piiValues` returns them · lane 07
- [ ] 0801 schema · S · red-team: the `s.json()` check overflows the stack on about 200k nesting from a JSON body · lane 07
- [ ] 0802 store · S · red-team: a large `keyLimit` costs O(keyLimit) per keyed write; `restore` parses a forged `keys` array whole · lane 07
- [ ] 0402 tooling · S · the `pnpm.overrides` pins (`minimatch`, `qs`) are ignored by this pnpm; move them, pin `packageManager`, rerun `pnpm audit` · lane 08
- [ ] 0942 tooling · S · CI workflows declare no `permissions:`, pin actions by tag and hand `TURBO_TOKEN` to every step · lane 08
- [ ] 0353 docs, spec · S · one `KEEL_SECRET` signs callers for every deployable; state it in k.topology and THREAT-MODEL · lane 09
- [ ] 0748 store, docs · S · THREAT-MODEL does not name `keys` in `#k-state`; `openHub.ts` re-derives keys `restore` derives · lane 09
- [ ] 0785 docs, spec · S · state the decided limit: app code holding the ctx can `dispose()` its online and offline events · lane 09
- [ ] 0787 docs · S · THREAT-MODEL (stored logs) does not mention the store's `keyLimit` · lane 09
- [ ] 0656 spec · S · k.privacy's `[pii]` sentence for a later throw names a path no request reaches; reword it · lane 09
- [ ] 0690 docs, spec · S · the server README lists the scrubbed encodings and k.privacy does not; spec them or mark the README as no contract · lane 09
- [ ] 0674 spec, skills · S · neither k.guards nor k.api says whether a bearer check denies in a guard or a loader · lane 09
- [ ] 0867 spec, server, testing · M · how a recorded session learns the caller lifetime is described by RFC 0139 and not specified · lane 09
- [ ] 0282 runtime-dom, compiler · M · a throwing binding carries the element's runtime `id`, which may be app data, into `data.at`; k.runtime needs a trim first · lane 10
- [ ] 0775 cli, compiler · S · red-team: a `vite.config.ts` that sets `NODE_ENV` gives app code `DEV === true` under `keel build` · lane 10
- [ ] 0424 compiler · S · the client entry embeds the deployable-to-module map, so server module names reach the browser · lane 16
- [ ] 0953 compiler · M · a build-time assertion that a server bundle reaches no CLI-time package through a `deps` package (RFC, reserved code) · lane 16
- [ ] 0332 apps/golden-2 · S · the URL's `recipeId` renders as the not-found page's `h1`, so any sentence shows in the app's voice · lane 11
- [ ] 0688 apps/golden-2 · S · sign-up answers "Already signed up", which tells anyone whether an email has an account · lane 11
- [ ] 0903 apps/golden-2 · S · `identify` returns the bearer answer whenever an `authorization` header is present and never reads the session cookie · lane 11
- [ ] 0911 apps/golden-2 · S · `POST /api/recipes` writes without a signed-in user while `/recipes/new` is guarded · lane 11
- [ ] 0608 std-capacitor, spec · M · Capacitor's net driver sends a URL on another origin while Tauri's scope refuses it; one rule for k.shell · lane 14
- [ ] 0616 std-jobs, check · M · no tools rule reports a revealed value passed to `enqueue` (needs E1112's value walk exported) · lane 15
- [ ] 0617 forms, check · S · no warning when a password control binds a field that is not `s.secret` · lane 15
- [ ] 0638 std-tokens, check · S · E2203, a `Digested` node in a loader `output`, waits on the checker exporting its schema reader · lane 15
- [ ] 0957 check, std-capacitor · S · a Capacitor app with `identity.ts` missing `@capacitor/app` or `@capacitor/browser` is not reported (extend E1572) · lane 15
- [ ] 0434 check · M · a module's declared `capabilities` are not enforced (golden-1 `api` used storage with `["random"]`) · lane 15
- [ ] 0812 std-db · S · `sslmode=require` reads as full verification with a multi-line warning; TLS ran against a local server only · lane 19
- [ ] 0829 tooling, std-db · S · the three TLS cases skip in CI; start Postgres with a certificate in a step · lane 19
- [ ] 0302 std-sessions · S · red-team: E2005 misses `createRequire`, `module.require`, aliased `require` and non-literal `import()` · lane 18
- [ ] 0779 std-temporal · S · red-team: `TimeZone.parse` builds an `Intl.DateTimeFormat` per call; cache per name · lane 18
- [ ] 0525 std-sessions · S · serving `sessions.tally` also serves `POST /sessions` and `GET /sessions/list` on that deployable · lane 18
- [ ] 0943 release · S · 40 packages are publishable; mark them private until launch · in flight
- [ ] 0944 release, docs · S · `.gitignore` gaps, no `SECURITY.md` or `CONTRIBUTING.md`, THREAT-MODEL out of date on streams · in flight
- [ ] 0946 release · M · strip home paths and quotations of the operator before the public repository; a check that fails on either · in flight
- [ ] 0956 router, std-capacitor, std-tauri · L · any page can open a shell return link with native cookies; RFC 0147 build · in flight

### Accessibility

- [ ] 0314 router, server · S · after a server-rendered first page with a route title, later untitled pages keep that title · lane 03
- [ ] 0796 check · S · red-team: E1802 passes a label of C0 and C1 controls · lane 05
- [ ] 0463 compiler · S · the E1805 fix writes `<Box as="aside">` with no label, which is E1802 · lane 10
- [ ] 0396 apps/golden-1 · M · golden-1 a11y: one title per deployable, two unlabelled `nav`, every row link named "Edit", unlabelled counts, body-colour errors · lane 12
- [ ] 0475 testing · S · `landmark-unique` does not collapse whitespace and counts hidden landmarks · lane 12
- [ ] 0572 testing, cli, spec · S · the 1.3.2 and 2.4.3 claims map only to E1820 and are always `none`; earn or drop them · lane 12
- [ ] 0573 testing · M · harness `click` moves no focus, `th scope=row` reads as `columnheader`, `aria-rowindex` has no state key · lane 12
- [ ] 0580 testing · S · neither a11y agreement file has a labelled `Box as="nav"` or `"section"` case (conformance, `rfc:` commit) · lane 12
- [ ] 0874 ui · S · `Text` has no `role` · lane 12
- [ ] 0932 ui · M · no app-level live region, so a result line after an action is not announced · lane 12
- [ ] 0964 apps/golden-1, ui · S · on the iOS Simulator a tap on the `Done: Bread` label text makes no `change` · lane 14

### Missing conformance and false claims

- [ ] 0270 cli, std-sessions · S · red-team: the ledger counts a range clause covered when any one file cites it · lane 13
- [ ] 0531 spec · S · the k.ledger sentence for 0270 and the k.testing RFC for 0317 · lane 13
- [ ] 0346 cli, spec · M · k.topology gives no programmatic way to start `keel dev` from a test · lane 13
- [ ] 0349 server, scaffold, cli · M · k.topology clauses 2, 6 and 9 have no evidence; complete the tests or narrow the sentences, then flip · lane 13
- [ ] 0423 server, services · S · k.hosting clause 2's `service({ module })` half has no conformance assertion · lane 13
- [ ] 0693 server · S · k.hosting clause 2's fetch URL, `credentials: 'include'` and unset case are observed by no test · lane 13
- [ ] 0689 apps/golden-2, server · S · k.api's "never 303" bullet has no named test; golden-2 `tokens.test.ts` asserts only wiring · lane 11
- [ ] 0334 router, apps/golden-2, evals · S · tests that check little: no param second segment in the prefix property, a not-found test that asserts length · lane 11
- [ ] 0366 evals · S · `golden-1-api` acceptance hardcodes topologies and its hop count is a tautology · lane 11
- [ ] 0692 compiler · S · k.shell clause 6's test matches the word `drivers`, which any bundle holds · lane 16
- [ ] 0747 runtime-dom · S · `resume` with `mode: "dev"` has no conformance case · lane 10
- [x] 0783 std-channels · S · the std.channels sentence on a member refusing `""` has no test of its own · lane 01
- [ ] 0281 runtime-dom · S · a nested `Boundary` inside a resumed island on the claim path has no test (rfc:0075 leads) · lane 10
- [ ] 0287 reactive, store · S · `untrack` and `scope.run` reads of a thrown computed, and effects disposed while queued, are untested · lane 07
- [ ] 0469 schema, cli, router · M · values a user sees as blank pass `required`, and JSON Schema `\S` disagrees with Python; decide the blank set in k.schema · lane 07
- [ ] 0328 std-text · S · `line` and `para` accept text that shows as nothing or reorders; build RFC 0116 · lane 05
- [ ] 0804 std-text, check · S · the visible-character regex lives in three places and check and std-text disagree on a lone surrogate · lane 05
- [ ] 0507 std-live · S · a `read` that never resolves leaves `status()` at `live`; build RFC 0114 · lane 18
- [ ] 0304 compiler, server · M · a node deployable's build emits no CSS, so node-rendered pages link no stylesheet · lane 16
- [ ] 0372 compiler · S · a stdlib module placed directly in a deployable is omitted from the server entry silently (suspected) · lane 06
- [ ] 0486 compiler, check, std-sessions · M · E1559 and the artifact hashes read app `routes.ts` only, so stdlib-served paths go unchecked · lane 06
- [ ] 0926 compiler · M · a placed stdlib module that resolves no routes is silent; report it (RFC for the diagnostic) · lane 06
- [ ] 0954 spec, compiler · M · k.cli Inspect says nothing of one origin serving two deployables' sections; golden-2's page timings are hidden (RFC) · lane 16
- [ ] 0368 scaffold, check · S · generated CI runs `keel check` without `--base` when the base surface is missing, disabling E1562 silently · lane 17
- [ ] 0371 check, compiler, std-jobs · M · compat `accepts`, `routeFor`, `pathCollisions` and std-jobs `callsOf` each miss a case · lane 17
- [ ] 0883 scaffold · S · `keel scaffold service` in a client-only module writes a file that fails E1571 · lane 17
- [ ] 0330 check, router · M · a guard redirect carries params by name only; check the carried fields' schemas in E1508's static half · lane 15
- [ ] 0918 check, testing · S · a rule that throws becomes E1756, which tests filtering for one code never see · lane 15
- [ ] 0936 check, cli · S · `keel build`'s check step reads a `dist/` left by `vite build` and reports E1561 · lane 15
- [ ] 0826 std-tauri · M · a kill inside a store save and power loss are not shown; plugin-store does not fsync · lane 19
- [ ] 0292 apps, tooling · S · `keel check` reports 7 errors in apps/sessions and no app's `check` script runs the checker · lane 08
- [ ] 0958 std-capacitor, std-tauri, apps, tooling · L · the return-link path has no device proof and no app with `identity.ts` has a shell · lane 14
- [ ] 0836 evals, apps/golden-3 · L · golden-3 has never been built; owned by W1 step 4, not a fix lane
- [ ] 0914 std-health, std-geo, std-i18n, std-brands, std-text · L · tests to kill surviving mutants under threshold in the std packages · lane 21
- [ ] 0916 tooling · S · the mutation cache reuses a result after tests are added; key it on the test files · lane 20
- [ ] 0919 tooling · M · mutation for `apps/*`: the tool and the ledger read `packages/` only · lane 20
- [ ] 0960 testing, tooling · M · S0009 does not walk past `@keel/testing` because of a dynamic `vitest` import · lane 20
- [ ] 0877 tooling · S · `pnpm evidence:report` writes data from a dirty tree without refusing · in flight
- [ ] 0892 tooling · M · red-team: no gate catches a committed ledger or evidence file that differs from what the tree produces · in flight
- [ ] 0938 tooling, cli · M · a cold parallel `pnpm test` fails one task in three runs and passes on rerun · in flight
- [ ] 0965 tooling, shells · S · the `shell-drive.mjs` steps have not run on a GitHub runner · in flight
- [ ] 0966 std-sessions, tooling · S · std-sessions mutation is unmeasurable for want of a mutation vitest config · in flight
- [ ] 0967 server · L · 961 server mutants survive; find whether tests miss them and write the tests · in flight

## 2 Docs sweep (W12 step 4)

- [ ] 0229 docs, spec, packages · the sweep and reset for 1.0 itself
- [ ] 0497 store, server · RFC ids in older code comments
- [ ] 0598 docs · RFC and backlog ids in package READMEs and `docs/guide/**`
- [ ] 0745 std-schedules · an RFC tag on line 1 of a conformance file (`rfc:` commit)
- [ ] 0275 router, spec · invalid search values fall back to defaults with 200; state the default in k.router
- [ ] 0289 spec · state the decided Boundary reset behaviour (an outside computed keeps its error until a source changes)
- [ ] 0313 spec · state that `routes.ts` is evaluated on Node with no DOM, or install the server DOM first
- [ ] 0318 check, std-i18n, std-messages · `keel explain` entries for E2301 and E2401 to E2406
- [ ] 0485 std-sessions · `keel explain` entries for E2002 to E2004
- [ ] 0341 spec · add the route error answer and E1006 for an endpoints file to k.compat
- [ ] 0348 spec · state the runner rejection code and the `KEEL_ORIGIN` and `KEEL_PEER_<NAME>` requirements in k.topology
- [ ] 0388 spec · state the opaque redirect a browser gives a `client` deployable's service call
- [ ] 0416 docs · a derived file count in `docs/guide/build-golden-1.md`
- [ ] 0425 docs · the unrun nginx example and the "7 artifacts" claim in `docs/guide/deploy-client.md`
- [ ] 0481 spec · std.offline writes `Write` with an option `s.number` does not take
- [ ] 0484 spec · state the same-`at` replay order limit in std.multi
- [ ] 0529 skills · a line in keel-testing on a fresh `createApp` per `simulate` run
- [ ] 0574 testing · `HarnessArtifacts` says `keel test` passes it; correct the doc
- [ ] 0655 spec · k.server's `action` bullet omits `bearer` (section at its token limit)
- [ ] 0676 skills · the capabilities `credentials(ctx)` needs, and the missing-dependency case
- [ ] 0678 skills, apps · the stale golden-2 forms example and the import-order lint note
- [ ] 0730 docs · RFC 0108 D2 lists the wrong subpaths
- [ ] 0828 spec · std.db names no pool timeout
- [ ] 0855 spec · E1759's clause for a project with no `topology.ts`
- [ ] 0881 docs · principle 2 against build-time stubs of server-only files
- [ ] 0904 spec · k.bundle's environment exception omits `KEEL_DEPLOYABLE`, `KEEL_SHELL`, `KEEL_INSPECT_ORIGINS`
- [ ] 0909 spec · the dev server and the identity `handle.path` and server-only stubs
- [ ] 0931 spec · E2101 runs project-wide once one module lists std-brands
- [ ] 0948 spec, docs · k.shell's CI paragraph and ROADMAP on iOS and macOS Tauri jobs

## 3 Feature ideas for `tasks/FUTURE.md`

- [ ] 0383 services · derive client reply types from the route surface: a new derivation; hand-written reply schemas work today
- [ ] 0603 check · E1111 reading `x-keel-pii` from `routes.json`: a refactor of a rule that works
- [ ] 0604 ui · label props taking a signal or computed directly: a new API shape, getters work today
- [ ] 0621 store · a public replay function: a new API; the restart smoke checks the log structurally
- [ ] 0627 check · an E1112 false positive that waits on the types-mode FUTURE line
- [ ] 0640 std-tokens · `$hmac-sha256$` digests once Keel has an app key path: a new digest kind
- [ ] 0930 std-timings, server · a timings reader in a build (`Server-Timing` or a log record): the dev reader is the 1.0 feature

## 4 Other

### In flight or owned by a named workstream
- [ ] 0034 W1 step 1: the freeze review, in flight
- [ ] 0963 the active task to the start of P1
- [ ] 0230 program: the lane table, the orchestrator's
- [ ] 0312 S6 stage: closes with W4
- [ ] 0337 S7 stage
- [ ] 0220 W6 step 1
- [ ] 0221 W6 step 2
- [ ] 0355 W6 step 3
- [ ] 0839 W6 step 3
- [ ] 0308 W7: the scaffold's locale template, decided (D7)
- [ ] 0222 W5 step 4
- [ ] 0429 W5: the `golden-1` eval task
- [ ] 0577 W5: the `golden-2-catalog` eval twins
- [ ] 0673 W5 step 4: carrying a signed-in caller's cookie in tests, a decision
- [ ] 0675 W5 step 4: `renderRoute` has no log option
- [ ] 0807 W5 step 5: `keel spec` and the budgets measure differently
- [ ] 0223 W12 step 6: the launch checklist
- [ ] 0941 W12 step 1: the licence (operator, O4)
- [ ] 0906 operator: GitHub Actions spending limit

### W1: freeze decisions and k.shell
- [ ] 0316 route `title` props are untyped
- [ ] 0317 harness `find` exposes no `lang` or stable node handle
- [ ] 0339 whether `service({ module })` unwraps the loader envelope
- [ ] 0380 endpoint file naming against k.services and ADR-0028
- [ ] 0413 `docs/freeze-review.md` "Tested, not stated" list
- [ ] 0605 `styles` reserved on every component (user decision)
- [ ] 0845 `@keel/check` consolidation before the freeze
- [ ] 0609 no native build has run
- [ ] 0634 Tauri on Windows: `icon.ico`, no installer
- [ ] 0824 no physical device run
- [ ] 0825 the shell replay is one user's half
- [ ] 0827 no Android emulator replay
- [ ] 0866 device checks for a cookie that survives relaunch

### W3: evidence and mutation
- [ ] 0749 the evidence ramp
- [ ] 0403 mutation timeouts in rule files
- [ ] 0404 load-dependent kills
- [ ] 0405 ui scoped score below threshold
- [ ] 0443 mutation-only test exclusions
- [ ] 0524 scores fell, above threshold
- [ ] 0532 exports at `none` in the ledger
- [ ] 0625 scores fell on 2026-11-16
- [ ] 0626 check mutation budget and sandbox lists
- [ ] 0629 stale claims after RFC 0101
- [ ] 0713 slow scrub mutants
- [ ] 0718 `pnpm mutate:stale` measured run
- [ ] 0719 ledger clauses keyed by position
- [ ] 0761 `mutate:stale` counts disagree
- [ ] 0805 snapshot size with the default `keyLimit`
- [ ] 0816 coverage run bound for std-sessions
- [ ] 0821 PR mutation job, nightly chosen
- [ ] 0920 static mutants survive
- [ ] 0922 server Stryker exclusions
- [ ] 0924 never-mutated files

### Tooling, flakes and budgets
- [ ] 0291 Node declarations slow the type pass
- [ ] 0293 vitest 5
- [ ] 0294 `pnpm.overrides` location, joins 0402
- [ ] 0417 E1155 flake under load
- [ ] 0464 a slow scaffold conformance file
- [ ] 0514 std-schedules shrink time (`rfc:` edit)
- [ ] 0515 unbounded processes after the watchdog
- [ ] 0530 mutate lock race
- [ ] 0542 `holderAlive` and the stall clock
- [ ] 0570 quiet output hides the failing task
- [ ] 0579 format-check reads `reports/`
- [ ] 0651 PGlite V8 crash
- [ ] 0762 root test flakes under load
- [ ] 0767 inspector smoke not rerun
- [ ] 0808 regenerate STAGES and COVERAGE
- [ ] 0814 format-check reads ignored build output
- [ ] 0868 resume smoke crash
- [ ] 0878 docs-freshness cadence
- [ ] 0923 devStubs fixture resolution
- [ ] 0335 budget on golden-2's client entry
- [ ] 0342 scaffold budget headroom
- [ ] 0418 router budget headroom
- [ ] 0427 server budget headroom
- [ ] 0576 golden-2 client entry has no budget
- [ ] 0721 server budget headroom

### 1.0 completion work, stays in the backlog behind the weakness gate
- [ ] 0315 E1509 is not per deployable
- [ ] 0325 E2301 and E1106 resolve by identifier only
- [ ] 0331 `formatMessage` renders `NaN`, `''` and `-0` with no diag
- [ ] 0340 the surface builder lives in the cli binary
- [ ] 0343 `keel dev` serves one resume entry for two deployables
- [ ] 0344 E1559 from `keel check`
- [ ] 0378 golden-1 hand setup leans on the repo root
- [ ] 0381 `Form` inside a helper named `children`
- [ ] 0400 `keel dev` failure page and HMR
- [ ] 0414 the scaffolded project has no `node` deployable
- [ ] 0428 E1561 against a narrow declared error shape
- [ ] 0430 batch `codemod move`
- [ ] 0436 an uncoded unavailable-storage error
- [ ] 0447 E1405 misses cases
- [ ] 0461 `surface.json` goes stale in dev
- [ ] 0483 a made-up E1720 in a fixture
- [ ] 0496 ctx listener and kill-function retention (RFC 0115)
- [ ] 0506 `replayGroup` has no worker cap or call timeout
- [ ] 0508 MCP `build` diagnostics as records
- [ ] 0510 the `offline.storage` code (RFC 0112)
- [ ] 0513 std-sessions runtime deps on vite and vitest
- [ ] 0520 `server.port: 0` and the E1560 probe
- [ ] 0527 `resolve(..., 'mine')` answer (RFC 0112)
- [ ] 0538 tally merge needs compare-and-set storage
- [ ] 0578 a component called as a function in JSX renders nothing
- [ ] 0600 std-tables links re-apply the old `q`
- [ ] 0601 sessions app hand-built `Box` calls ship no CSS
- [ ] 0602 a non-literal style value is dropped silently
- [ ] 0611 SQLite `BEGIN IMMEDIATE` blocks the event loop
- [ ] 0619 E2351 and E2501 apply to test files
- [ ] 0677 scaffolded module placement and write-only routes
- [ ] 0765 sim net kill-function retention
- [ ] 0766 `NODE_ENV` for native build steps
- [ ] 0782 an unused `RESUME_ENTRY.ts`
- [ ] 0806 std-live aborts a settled read's signal
- [ ] 0813 every connect failure is E2153
- [ ] 0818 `keel build` deletes Cargo's target
- [ ] 0838 golden-1 lists unused std packages
- [ ] 0844 `resumeDocument` mounts no router
- [ ] 0857 E1406 not run over `packages/` with types
- [ ] 0859 std-headless uses `toLocaleLowerCase`
- [ ] 0872 `Button` has no `name` or `value`
- [ ] 0873 E2406 only for modules that list std-messages
- [ ] 0875 no helper for a redirect carrying an auth library's cookies
- [ ] 0876 `identify` cannot open a Keel store
- [ ] 0879 E1007 on stderr only
- [ ] 0901 check warnings dropped on a successful build
- [ ] 0905 E1010 for code files only
- [ ] 0908 dev and build answer an unmatched path differently
- [ ] 0910 vitest `vmThreads` pools get stubs
- [ ] 0929 std-geo sim has one position and no refusal
- [ ] 0935 three copies of `entryOf`
- [ ] 0955 dev reload leaves a removed inspector section
- [ ] 0959 Tauri single-instance does not focus the window

## Fix lanes

Lanes are ordered by severity. Each lane is one agent and one context window over the packages named; lanes that run at the same time share no package. Tier: opus where a kernel change, a spec decision or an RFC is needed, otherwise sonnet. A conformance file changes only in an `rfc:` commit by the conformance-writer.

| Lane | Packages | Lines | Count | Tier | Tests |
| --- | --- | --- | --- | --- | --- |
| 01 offline-channels | std-offline, std-channels | 0501 0509 0797 0798 0799 0800 0945 0478 0777 0783 | 10 | opus | yes |
| 02 server-scrub | server | 0441 0442 0671 0683 0722 0729 0737 0756 | 8 | sonnet | yes |
| 03 router-mount | router, compiler (E1579), testing, std-messages, forms | 0894 0893 0895 0336 0314 | 5 | sonnet | yes |
| 04 server-edges | server, apps/sessions, tooling smokes | 0503 0364 0350 0569 0415 0274 0865 | 7 | opus | yes |
| 05 check-privacy | check, std-text | 0733 0831 0856 0880 0884 0519 0796 0328 0804 | 9 | sonnet | yes |
| 06 compiler-routes | compiler, cli, check, std-sessions, apps/golden-1 | 0386 0521 0517 0372 0486 0926 | 6 | opus | yes |
| 07 kernel-data | schema, store, reactive | 0261 0595 0801 0802 0287 0469 | 6 | opus | yes |
| 08 supply-chain | tooling, `.github`, apps check scripts | 0402 0942 0292 | 3 | sonnet | no (audit and `keel check` only) |
| 09 threat-model | docs, spec, skills | 0353 0748 0785 0787 0656 0690 0674 0867 | 8 | opus | no |
| 10 runtime-errors | runtime-dom, compiler, cli | 0282 0775 0463 0747 0281 | 5 | opus | yes |
| 11 golden-2-access | apps/golden-2, evals | 0332 0688 0903 0911 0689 0334 0366 | 7 | sonnet | yes |
| 12 a11y | testing, ui, apps/golden-1 | 0396 0475 0572 0573 0580 0874 0932 | 7 | opus | yes |
| 13 conformance-topology | server, scaffold, cli, services | 0349 0346 0423 0693 0270 0531 | 6 | opus | yes |
| 14 shells | std-capacitor, std-tauri, apps (identity shell), golden-1 | 0608 0958 0964 | 3 | opus | yes (devices) |
| 15 check-tools | check, std-jobs, forms, std-tokens, std-capacitor | 0616 0617 0638 0957 0434 0330 0918 0936 | 8 | opus | yes |
| 16 compiler-boundary | compiler, server | 0424 0953 0954 0304 0692 | 5 | opus | yes |
| 17 compat | scaffold, check, compiler, std-jobs | 0368 0371 0883 | 3 | sonnet | yes |
| 18 std-runtime | std-live, std-sessions, std-temporal | 0507 0302 0525 0779 | 4 | sonnet | yes |
| 19 std-storage | std-db, std-tauri | 0812 0829 0826 | 3 | sonnet | yes |
| 20 mutation-tooling | tooling, testing | 0916 0919 0960 | 3 | sonnet | yes (mutation) |
| 21 std-mutation | std-health, std-geo, std-i18n, std-brands, std-text | 0914 | 1 | sonnet | yes (mutation, quiet machine) |

Lane total: 117 lines. With 0836 (W1 step 4) and the 10 in-flight lines that makes the 128 entries of list 1. Each list 1 entry names its lane, and the lane column above holds the same ids:

```sh
diff <(awk -F'|' '/^\| [0-9][0-9] /{print $4}' tasks/p1/weaknesses.md | tr ' ' '\n' | grep -E '^[0-9]{4}$' | sort) \
     <(awk '/^## /{n=substr($2,1,1)} n==1 && /^- \[ \] [0-9]{4} / && !/in flight|W1 step 4/' tasks/p1/weaknesses.md | cut -c7-10 | sort) && echo same
```

### Waves

At most two test-running lanes at once; the writing lanes (08, 09) run beside any wave.

| Wave | Test lanes | Waits for |
| --- | --- | --- |
| 1 | 01, 05 | none |
| 2 | 07, 03 | 03 after 0956 lands (router, std-capacitor) |
| 3 | 02, 12 | 02 after 0967 lands (server) |
| 4 | 04, 15 | 15 after 0956 (std-capacitor) |
| 5 | 06, 11 | 06 after 0966 lands (std-sessions) |
| 6 | 10, 18 | none |
| 7 | 13, 14 | 14 after 0956 and 0965 |
| 8 | 16, 19 | 19 after 0965 (CI file) |
| 9 | 17, 20 | 20 after 0966 and 0967 |
| 10 | 21 | a quiet machine |

- Writing lanes: 09 starts after 0944 lands (both edit `docs/THREAT-MODEL.md`); 08 takes 0402 and 0292 at once and 0942 after 0965 lands (both edit `.github/workflows`).
- Lane 13 closes W1 step 2's blocking items (0349); when the freeze review needs it first, it swaps with lane 02 in wave 3, since both touch server.
- Lanes 01, 07 and 10 open with the RFC their lines name (0120, 0121; the k.schema blank set; the k.runtime trim) under the RFC defaults.
