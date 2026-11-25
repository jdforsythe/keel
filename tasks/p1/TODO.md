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
- [ ] `next` backlog 1040 (the concurrency cap, measured on a quiet machine) and 1103 (not reproduced; the smoke now keeps its command's output)
- [ ] `next` check's 13 mutation chunks on the main line, when the machine is quiet

### W1 Freeze
- [x] `done` RFC 0163, the library format: RFC, ADR and spec made true against the tree; the build order is the RFC's last section
- [x] `done` slice 1, the library kind, on `lane-lib`, the RFC's integration line
- [x] `done` slices 2a, 2b, 3 and 4b, merged into the main line
- [ ] `next` slice 4, then 4 (the stdlib on the format) beside 4b (the app data seam, k.server-deps)
- [ ] `blocked` (slices 4 and 4b) k.parity's second part: kind gates, lint S0013, conformance for clauses 5 and 6
- [ ] `blocked` (k.parity) every kernel section `conformance-covered`, then the `frozen` flip
- [ ] `next` backlog 1100: the largest sections split so the map plus any one section fits principle 8 (the section cap is back at 3,100)
- [x] `done` RFC and ADR status lines say what is built
- [ ] `next` RFC 0191's last part: the `Box as="nav"` conformance case (backlog 0580)

### W2 Weakness clearance
The triage is `tasks/p1/weaknesses.md`: 102 lines to fix now in 17 lanes (A1), 105 after them in 15 lanes (A2), 24 for the docs sweep, 7 moved to `tasks/FUTURE.md`, 52 closed as done or overtaken, 2 that need a person.
- [x] `done` the backlog triaged with decisions, in fix lanes
- [ ] `running` lane 01 gate-flakes: three of its nine lines (`lane-gate`)
- [x] `done` lane 06 server-scrub-and-streams: RFC 0230
- [ ] `running` lane 07 check-security-rules: RFC 0231 (`lane-sec07`)
- [x] `done` lane 08 router-identity: RFC 0232
- [ ] `next` lanes 02 to 05 and 09 to 17, in the triage's order, as lanes free up
- [ ] `blocked` (A1) the A2 lanes 18 to 32
- [ ] `blocked` (fix lanes) a red-team pass, by Claude and by Codex, that files no new high or medium line

### W3 Evidence and coverage
- [x] `done` the survey (`tasks/p1/evidence-survey.md`)
- [x] `done` every page route outside household rendered with its a11y checks
- [ ] `running` RFC 0233: the a11y item key per project, `keel test` passing the artifacts by default, items per page route (`lane-a11yrfc`)
- [x] `done` household: every export has evidence; every page route rendered with its a11y checks
- [ ] `next` backlog 1106, 1107: a generated `s.id` with a shape a server mints; a found input gives its value
- [x] `done` RFC 0229: `unsafe` counts escapes in code that runs (13, from 35); negative type tests have their own home and count (90)
- [ ] `blocked` (survey) tier 1 packages to target, one lane per package
- [ ] `blocked` (tier 1) tier 2, then tier 3
- [ ] `next` mutation for the golden apps' modules (backlog 0919)
- [ ] `next` coverage measured again on the current head and published by CI from a clean checkout

### W5 Agent docs, W7 the walkthrough app, golden-3, W16 head to head (the apps that prove it)
- [ ] `next` `keel docs <topic>` reading the docs shipped in the packages; `AGENTS.md`; the app-work skills checked against the tree
- [ ] `next` the walkthrough app, ten layers, each chapter run once as an eval
- [ ] `blocked` (agent docs) golden-3 built by an agent run of its eval with Claude, then with Codex; every finding filed
- [ ] `blocked` (golden-3) the `public-docs` eval converging with Claude and with Codex
- [ ] `blocked` (walkthrough) head to head: the harness and three pairs against the comparison list, each result dated and versioned

### W6 Human docs, W8 the site, W9 the pitch, W10 showing it, W11 research
- [ ] `next` W11: the steal list verified
- [ ] `blocked` (freeze) diagrams, the tour, the guides, the generated reference
- [ ] `blocked` (W6, W11) the site built in Keel: zero axe violations, CSP served, budgets met, every number read from `evidence.json` with a claim check
- [ ] `blocked` (W3, W8) the comparison pages, each claim about another framework sourced
- [ ] `blocked` (W8) recorded and constructed visuals

### W13 the module contract, W14 app data, W15 custom components
- [ ] `next` W14: golden-2 moved onto the Postgres battery
- [ ] `next` W15: the two worked component examples pass `keel check` and the a11y checks with no rule off and no `unsafe/`
- [ ] `blocked` (RFC 0163) a third-party style library built in the format as an example

### W12 Release
- [ ] `next` release hygiene (backlog 0941, 0943, 0944, 0946)
- [ ] `blocked` (W6, W7, W9 stable) the docs sweep and reset: final ADRs distilled and checked against the code, numbered RFC, ADR and backlog references gone, a check that fails on one
- [ ] `blocked` (sweep) `changeset version` and `pnpm publish --dry-run` with provenance in CI; a clean-runner job that scaffolds from the packed tarballs and runs `keel check`
- [ ] `blocked` (all above) the release checklist

## Needs a human

Each of these is started as early as its inputs allow, since they have the longest lead times.

- [ ] A physical Android device, a physical iOS device and a Windows machine, for the shell runs CI cannot make (backlog 0824).
- [ ] Accessibility audit and penetration test: choose and pay one firm for each (scope: golden-3 and the site, a retest included). The lead writes the scope documents and a vendor shortlist.
- [ ] A newcomer reviewer: one person who writes TypeScript and has never seen the repo, to read the docs and the walkthrough.
- [ ] A domain and a static host account for the site.
- [ ] The npm organization and the GitHub organization for the fresh public repository.
- [ ] The licence, chosen at launch.
- [ ] An address a person answers, for `SECURITY.md`.

## Launch (P2)

- [ ] The fresh public repository from one commit of the swept tree; this repository goes private
- [ ] Packages on npm at 0.x with provenance
- [ ] The site live
- [ ] An outsider builds an app from the docs
- [ ] 1.0.0 after four weeks with no kernel semantic change and no frozen section reopened
