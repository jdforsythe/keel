# Road to public

The working list from today's tree to the public release. `tasks/p1/PLAN.md` holds the design of each workstream and its exit criteria; this file holds what is in, what runs, what waits and on whom. The engineering lead keeps it current at every handoff. A line is done when its proof is in the tree and CI is green on it.

State words: `done` · `running` (a lane is open) · `next` (unblocked, no lane yet) · `blocked` (names what blocks it) · `human` (needs a person, listed under "Needs a human").

## The bar

Keel goes public when a serious engineer, an auditor and a first user can each push on it and it holds. Correctness comes first: a wrong program does not pass `keel check`, a claim on the site is a number CI produced, and a gate that flakes is a defect. Nothing is cut from the kernel or the stdlib to get there.

## Quality targets

Each package is raised until one more test would only restate the implementation. A file is finished when every surviving mutant is killed or justified in the ledger as equivalent or unreachable, and every public export that runs has evidence. The tiers say how far each package goes first and where its gate sits; when a package reaches its target its gate threshold rises to three points under its score, so it cannot slide back.

| Tier | What a bug here costs | Packages | Mutation target | Evidence target | Branch coverage |
| --- | --- | --- | --- | --- | --- |
| 1 | data lost or leaked, access granted wrongly, a wrong program passes the gate | schema, reactive, store, router, server, ctx, forms, check, std-db, std-postgres, std-sessions, std-tokens, std-offline, std-conflicts | 90 | every export that runs at `probabilistic` or higher; every stated law at `exhaustive` or `proven` where a closed form exists | 95 |
| 2 | wrong output a person sees, a build that fails loudly | compiler, runtime-dom, ui, testing, services, cli, scaffold, std-workflows, std-statecharts, std-channels, std-live, std-jobs, std-schedules, std-i18n, std-money, std-temporal, std-tables, std-headless, std-messages, std-timings | 80 | every export that runs has an example, and a property where it ranges over inputs | 85 |
| 3 | an adapter or thin wrapper misbehaves and a smoke catches it | std-capacitor, std-tauri, std-geo, std-health, std-report, std-text, std-brands | 75 | every export that runs has an example; behaviour shown by a built smoke in CI | 80 |

Apps (`apps/*`, `examples/*`) are proof vehicles: each passes `keel check` and `keel test` with no rule switched off and no file under `unsafe/`, and the golden apps carry mutation runs of their modules.

The `unsafe` count measures escapes from the type system in code that runs. Negative type tests are counted on their own line.

## In, by workstream

### Gate and tooling health (first: every other lane trips over these)
- [x] `done` backlog 1102: check's mutation run gets past its initial test run; no test writes a type cache beside an app
- [ ] `next` backlog 1105: a bound on `mutate.mjs --stop`
- [x] `done` backlog 0991: a scaffolded project builds on first run
- [ ] `next` the gate equals CI: `pnpm gate` runs CI's jobs from `tooling/ci.source.json` and every test time bound goes through one scale (done); the whole gate has failed three times on time bounds at one tenth scale, four bounds and one smoke left (`tasks/0963-to-p1/PLAN.md`, checkpoint 104); then CI green on the pushed head
- [ ] `next` backlog 1040 (the concurrency cap), 1103, 1115, 1119
- [ ] `next` a slow-machine job in `pnpm gate`: the test shards in a Linux container with CPUs constrained to CI's runner or less, since three CI failures in a row (charts' property timeout, the watchdog's hook bound, household's simulation budget) passed on this machine and failed on a 4-core runner
- [ ] `next` check's 13 mutation chunks on the main line, when the machine is quiet

### W1 Freeze
- [x] `done` RFC 0163, the library format: RFC, ADR and spec made true against the tree; the build order is the RFC's last section
- [x] `done` slices 1, 2a, 2b, 3 (`keel pack`, `keel scaffold library`, two examples) and 4b (the app data seam, k.server-deps), on the main line
- [ ] `running` slice 4: the stdlib on the format: 11 of 26 on the main line (headless, statecharts, jobs, workflows, schedules, channels, live, offline, conflicts, postgres, db); twelve in `lane-std-formats` with RFC 0239; std-sessions in `lane-std-sessions` with RFC 0240; the two shells in slice 5
- [ ] `blocked` (slice 4) k.parity's second part: kind gates, lint S0013, conformance for clauses 5 and 6
- [ ] `blocked` (k.parity) every kernel section `conformance-covered`, then the `frozen` flip
- [ ] `next` backlog 1100: the largest sections split so the map plus any one section fits principle 8 (the section cap is back at 3,100)
- [x] `done` RFC and ADR status lines say what is built
- [ ] `next` RFC 0191's last part: the `Box as="nav"` conformance case (backlog 0580)

- [ ] `running` the `unsafe` count comes down (the plan's D192): 33 on the main line and 39 in `lane-std-formats`, most of it one throw wrapper per stdlib package and the detached scopes; RFC 0242 gives a library a sanctioned defect signal and module-level ownership so those stop being escapes; then the casts a type guard or a typed schema builder removes (`testing/unsafe/axeSync.ts`, `std-messages/unsafe/asEntry.ts`, `std-tables/unsafe/asQuerySchema.ts`); the target is below the 13 the kernel alone had

### W2 Weakness clearance
The triage is `tasks/p1/weaknesses.md`: 102 lines to fix now in 17 lanes (A1), 105 after them in 15 lanes (A2), 24 for the docs sweep, 7 moved to `tasks/FUTURE.md`, 52 closed as done or overtaken, 2 that need a person.
- [x] `done` the backlog triaged with decisions, in fix lanes
- [ ] `running` lane 01 gate-flakes: 0991 done; the rest with the gate work above
- [x] `done` lane 06 server-scrub-and-streams: RFC 0230
- [x] `done` lane 07 check-security-rules: RFC 0231
- [x] `done` lane 08 router-identity: RFC 0232
- [x] `done` lane 09 pii-and-data: RFC 0236
- [ ] `running` lane 03 ledger-integrity: RFC 0235 steps 1 to 5 on the main line (the ledger rests on run reports; items keyed by text); step 6 next
- [ ] `next` lanes 02, 04, 05 and 10 to 17 and 33, in the triage's order, as lanes free up
- [ ] `blocked` (A1) the A2 lanes 18 to 32
- [ ] `blocked` (fix lanes) a red-team pass, by Claude and by Codex, that files no new high or medium line

### W3 Evidence and coverage
- [x] `done` the survey (`tasks/p1/evidence-survey.md`)
- [x] `done` every page route outside household rendered with its a11y checks
- [x] `done` RFC 0233: an a11y item per page route and per project, `keel test` passing the artifacts by default: 620 of 620 items with evidence
- [x] `done` RFC 0234: static contrast judged from the command line
- [x] `done` household: every export has evidence; every page route rendered with its a11y checks
- [ ] `next` backlog 1106, 1107: a generated `s.id` with a shape a server mints; a found input gives its value
- [x] `done` RFC 0229: `unsafe` counts escapes in code that runs (13, from 35); negative type tests have their own home and count (90)
- [ ] `blocked` (survey) tier 1 packages to target, one lane per package
- [ ] `blocked` (tier 1) tier 2, then tier 3
- [ ] `next` mutation for the golden apps' modules (backlog 0919)
- [ ] `next` coverage measured again on the current head and published by CI from a clean checkout

### W5 Agent docs, W7 the walkthrough app, golden-3, W16 head to head (the apps that prove it)
- [ ] `running` the app-work skills: 47 findings from three builds placed (`tasks/p1/w5-dispositions.md`), a `keel-library` skill; `keel docs <topic>` reading the docs shipped in the packages is next, with its output size (the golden-3 trial spends a quarter of its turns there)
- [x] `done` the walkthrough app's design (`tasks/p1/walkthrough-design.md`): Evenly, a group trip's shared costs, fourteen layers from a page with no server to native shells
- [x] `done` Evenly layers 1 to 3, on the main line
- [ ] `blocked` (spike A: a browser data capability `place` can move to the server) layer 4 on; layer 6 after library slice 4; layer 13 after the session-to-test fixes; chapter evals after the agent docs
- [ ] `running` golden-3 built by an agent run of its eval: three Claude trials, none converged (`tasks/p1/app-trials.md`: the kit's exports fixed; the next blocker's fix is in `lane-std-formats`); Codex built the Recipe box through the head to head harness (28 of 28) and has no golden-3 path yet
- [ ] `blocked` (golden-3) the `public-docs` eval converging with Claude and with Codex
- [ ] `blocked` (walkthrough) head to head: the harness and three pairs against the comparison list, each result dated and versioned

### W6 Human docs, W8 the site, W9 the pitch, W10 showing it, W11 research
- [x] `done` W11: the steal list verified against the live sites (`tasks/p1/research.md`: 22 items checked, 14 added, the six frameworks' current versions, what the first five minutes should be)
- [ ] `blocked` (freeze) diagrams, the tour, the guides, the generated reference
- [ ] `blocked` (W6, W11) the site built in Keel: zero axe violations, CSP served, budgets met, every number read from `evidence.json` with a claim check
- [ ] `blocked` (W3, W8) the comparison pages, each claim about another framework sourced
- [ ] `blocked` (W8) recorded and constructed visuals

### W13 the module contract, W14 app data, W15 custom components
- [ ] `next` W14: golden-2 moved onto the Postgres battery
- [ ] `next` W15: the two worked component examples pass `keel check` and the a11y checks with no rule off and no `unsafe/`
- [x] `done` a third-party style library built in the format: `libraries/charts`, used by household, packed and installed from its tarball

### W17 The end user's seat (the personas, hands-on from the kit)
`tasks/p1/personas.md` holds who Keel is for; `tasks/p1/end-user-review.md` holds each review's findings. Two reviews are in (a component library author; a product engineer with a third-party library): both "yes, with pain". In this order:
- [ ] `next` the install path: `pnpm create keel` (a `create-keel` package), a kit README with the `overrides` recipe until npm; the clean-runner job of W12 uses it
- [ ] `next` the library trust holes, as RFC 0240's next part: a library's `./tools` (code that runs at check and build) and its `unsafe/` are capabilities an app grants; a library's ledger rungs are verified from its shipped run report or shown as claimed; the scaffolded CI runs `keel ledger --diff`
- [ ] `next` `@keel/server` answers 500 and keeps running when server-render code rejects (E1577)
- [ ] `running` token names at `keel check` (RFC 0241, app code); then a library's own folder and a listed library's `src/`, and E1801 with file and line at build
- [ ] `next` an RFC for a library's look (the plan's D188): a library ships a tokens object the app composes in its own `tokens.ts` as it composes `brandTokens`; needed names declared, namespaced by library id and checked against the app's at `keel check`; nothing applies without the app's import; `Part` roles a component library needs (switch, slider, radio and the rest of the authoring practices)
- [ ] `next` testing as an app or library developer finds it: `fire` submit with `app`; `simulate` over `createApp` (E1729 with its two entries); `properties(Component)` with an id-shaped id; a probe's property credits its component; `console.log` visible; an own-folder a11y report, evidence and a mutation command for a library
- [ ] `next` an RFC for end-to-end tests: `keel test --e2e` over the built app in a real browser, from `@keel/testing`; the repo's smokes move onto it
- [ ] `next` a library's publish story: a Publish paragraph in k.library-pack and keel-library, a scaffolded CI workflow with provenance; `keel scaffold library` writes the agent files and `.gitignore`
- [ ] `next` the paper cuts of both reviews (the leftover `app` module and E1552, E1005 after each edit, generated form ids, E1052's message, `keel review` on a fresh app, `keel docs` for installed libraries, a no-server app importing `@keel/server`, E1751's cut message, slot and `Part` examples in keel-library)
- [ ] `next` the remaining reviews, each a role and a kind: a static content site (A1, K1); a designer re-theming an app and a library (A5); a compliance owner reading `keel evidence` (A6); a tester (A7); a service library such as maps with a script from another origin (L3); a plain npm package inside an app (L6); a storefront (K2); a SaaS over services (K4); each also run by Codex as the agent form
- [ ] `next` an embedded piece (K9): Keel for one corner of an existing site, as a review and then a guide; the first question an enterprise with an existing product asks
- [ ] `next` a second colour scheme (dark mode): decided inside the look RFC, since it is a question about tokens; no line held it before
- [ ] `next` measured claims for the pitch: an agent builds the same app in Keel and in the comparison frameworks (W16), and a runtime and bundle size comparison produced by CI (none is planned elsewhere); until both exist the site claims neither
- [ ] `next` the repository's own numbers agree: the README says 603 clauses and 35 packages against the ledger's 1,479 and 41; the handoff says 78 of 79 kernel sections conformance-covered where the spec status lines read 73 of 83; the `unsafe` count is 33 in the ledger; whether golden-2 already runs on the Postgres battery (its README says so, W14 says next); the two database variables (`KEEL_DATABASE_URL`, `KEEL_POSTGRES_URL`) explained in one place. Counts are generated, not typed, wherever a doc states one
- [ ] `next` colour forms a designer expects: k.values allows `#rgb` and `#rrggbb` only; widen to every opaque form contrast can judge exactly (`rgb()`, `hsl()`, `oklch()`), and decide what a colour with alpha is (an overlay token whose backdrop is stated, so contrast is still judged)
- [ ] `next` session recordings redesigned (RFC 0248, the plan's D199): a write-only ingest that needs a short-lived signed upload grant; a configured sink the server never reads back; no list route, reader guard or viewer registration; `keel session` works from the storage or a local folder; the nightly job reads the storage directly
- [ ] `next` themes (RFC 0249, the plan's D200): named themes beside light and dark, each a partial token set with a condition; print against screen; contrast per theme; every opaque colour form; `keel tokens import` from a design tokens file with modes as themes; a guide from a Figma file to a styled app
- [ ] `next` motion (RFC 0252, the plan's D203): transitions and easings as tokens and style props; named keyframes with enter and exit; page and shared-element transitions through the router; scroll-driven animation; reduced motion by construction and checked; a scope-owned way for code to animate
- [ ] `next` `keel check` refreshes its derived `.keel/` files before judging, so an edit needs no build in between; a stale committed artifact is an error only in CI's frozen mode
- [ ] `blocked` (freeze) a browser tool over the queryable runtime (RFC 0250): one extension for Chrome and Firefox with stores, the dependency graph, scopes and tasks, the a11y tree, tokens and contrast, the session recorder, and a server panel
- [ ] `human` another product ships a global `keel` binary: the bin name before npm

### W12 Release
- [x] `done` release hygiene (backlog 0941, 0943, 0944, 0946): `LICENSE`, `UNLICENSED`, every package private, `SECURITY.md`, `CONTRIBUTING.md`, each held by a hygiene check; `hygiene --launch` fails on the security address placeholder until it is set
- [ ] `blocked` (W6, W7, W9 stable) the docs sweep and reset: final ADRs distilled and checked against the code, numbered RFC, ADR and backlog references gone, a check that fails on one
- [ ] `blocked` (sweep) `changeset version` and `pnpm publish --dry-run` with provenance in CI; a clean-runner job that scaffolds from the packed tarballs and runs `keel check`
- [ ] `blocked` (all above) the release checklist

## Needs a human

Nothing blocks on a person now. Near the end of P1, in one sitting: a domain and a static host for the site; the npm and GitHub organizations; the licence; the address `SECURITY.md` names (`hygiene --launch` fails until it is set) and GitHub private vulnerability reporting turned on; a newcomer reviewer for the docs. The outside accessibility audit and penetration test run after P1 or at its end (`docs/reviews/` holds the scope documents and a shortlist for then); S6 is closed unless they reopen it.

## Launch (P2)

- [ ] The fresh public repository from one commit of the swept tree; this repository goes private
- [ ] Packages on npm at 0.x with provenance
- [ ] The site live
- [ ] An outsider builds an app from the docs
- [ ] 1.0.0 after four weeks with no kernel semantic change and no frozen section reopened
