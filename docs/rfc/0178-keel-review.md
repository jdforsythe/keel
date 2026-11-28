# RFC 0178: k.review, k.escapes: `keel review` lists every escape from the framework's protections, ranked by danger and novelty

Status: implemented (ADR-0200). The owner accepted `keel review` for 1.0 and delegated its design decisions to the orchestrator; D12 to D19 resolve what was open and D20 to D30 what the build found. k.review and k.escapes are `implemented`.

## Decisions
- D1: two new kernel sections, k.review (command, findings, danger, novelty, loudness, baseline, CI job) and k.escapes (the codes), and a new command, `keel review [<base>..<head> | --all]`, in `@keel/cli`. `keel check` stays the per-file correctness gate and keeps its exit code; review is a separate, diff-aware report over a range or a tree.
- D2: one new term, **escape**: a place where code opts out of a protection by a sanctioned name (an **opt-in**) or goes around one (a **workaround**). Each escape is one finding.
- D3: findings take a new code letter, `R`, with their own number space (R1xxx kernel; R2xxx kept for stdlib findings). An E code fails `keel check` by its letter and a W code never fails; a finding's loudness comes from its danger and its novelty, which neither letter can carry. The command's own usage errors are E codes in k.cli's block (E1065 to E1068).
- D4: four danger levels, `critical`, `high`, `medium`, `low`, assigned by what an attacker or a mistake reaches through the escape (Proposal, Danger).
- D5: novelty is `new`, `changed`, `standing` or `accepted`, read by comparing findings at `<base>` and `<head>` by a line-independent fingerprint.
- D6: loudness is `fail`, `warn`, `list` or `count`, from one table of danger by novelty; a sanctioned opt-in sits one step quieter than a workaround of the same danger. Exit 1 when any finding is `fail`.
- D7: accepted escapes live in a new file, `keel-review.json`, beside `topology.ts` (or at the git root for a monorepo), read at `<base>`, never at `<head>`. An acceptance added in the range under review silences nothing in that range.
- D8: evasion is a finding. An assembled directive, a computed module specifier, a computed global, a file the review cannot read, and every change to the review's own inputs or to check, lint, type, test, install or CI configuration are findings at `critical`.
- D9: the review reads every tracked file. The exemptions `keel check` makes for app code (`unsafe/`, tests, `*.config.*`, `.d.ts`, `.keel/`) do not apply.
- D10: an app-facing skill, `keel-escapes`, ships in `packages/cli/skills`. It reads `keel review --format=json` and answers what a rule cannot: is this the Keel way, is there a seam for it, does the justification hold, was a test weakened to pass. It never approves a range and never writes the baseline.
- D11: 1.0 holds the smallest set that does the job (the command, findings, baseline, skill and 22 codes) plus the cheap parts that close an evasion path or keep the baseline honest: R1060 (a deleted test or fewer assertions), R1107 (an edited generated file), R1108 (fewer `.pii(`, `s.secret(` or `guard(` calls), R1151 (a stale acceptance) and the generated CI's `review` job. 26 codes, the skill, about 1,900 lines. Later: the opt-ins no evasion depends on (`clientPii`, `links`, service bases, `Host`, sessions `expose`, `bearer`, an unguarded action), a lowered budget or rung, stdlib R2xxx findings through `defineRule`, a matcher table for weakened assertions, and `review.json` in the evidence bundle.
- D12: it ships in 1.0 (the owner). k.review and k.escapes are `proposed` until built and covered. Rejected: holding it to after P1; three of the four Problem cases pass every app gate today.
- D13: the baseline is read at `<base>`, so an escape and its acceptance cannot land in one change (D7). Rejected: reading it at `<head>`, which lets the change under review accept its own escapes; the cost of the rule is one small change per accepted escape.
- D14: R1100 keeps no allow-list. In this repository a kernel RFC lane that also edits a golden app fails review, and the orchestrator reads the finding on merge, which is the reading this RFC asks for. Rejected: a path list in configuration, which would itself be an R1103 change and the first thing an agent edits.
- D15: k.cli takes one command row and one record kind; to stay within its 1,500-token docs clause the Output paragraph drops its sentence on the default mode, which OUTPUT.md Mode states. Rejected: re-basing the clause (a conformance clause of a covered section) and moving the Inspect text to k.hosting (a meaning move in a covered section).
- D16: the skill is `keel-escapes`. Rejected: `keel-review`, which this repository's PR checklist holds in `.claude/skills/`, where docs-check D0013 copies published skills; renaming that one changes this repository's workflow for a name.
- D17: the generated CI workflow's `review` job runs with the default exit (fail only). Rejected: `--fail-on warn` by default, which stops every pull request that adds a sanctioned opt-in; a team with no person reading pull requests sets it, and k.review documents it.
- D18: the review's text is split into k.review and k.escapes, each under the 1,875-token section budget. Rejected: re-basing `spec.section`, which raises the budget for every section to fit one code table.
- D19: k.deploy's CI bullet names the `review` job and keeps its status; the job's clause is k.review's (the last), so no covered section gains an uncovered clause. Rejected: a k.deploy clause, which would move k.deploy to `implemented` for one line.

- D20 (build): the command's usage errors for a range outside git or an unresolved revision, and for a baseline that does not parse, are E1069 and E1070. E1065 and E1066 are k.docs's (a section's package not installed; a packed file missing), so the RFC's numbers collided. Rejected: renumbering k.docs, a covered section whose conformance asserts both.
- D21 (build): `path` is relative to the git root in every run (outside git, to the working directory), so a monorepo's review and one project's give equal paths and ids. The `id` input is `<code>\n<path>\n<text>`; each code's text is stated in k.escapes. Rejected: project-relative paths, which change every id when an app moves into a monorepo.
- D22 (build): R1050 reads outside app code (k.check's): a test file, a `.d.ts`, a `*.config.*` file, `unsafe/`, `.keel/`. E1757 in fact reads test files too, so a cast in a test is both E1757 and R1050; the conformance clause asks for R1050 there. Review repeats none of E1757's forms in app code, E1576 (an `internal` or `#` specifier, dropped from R1055) or E1601's `fetch` (R1057 reads `fetch` under `unsafe/` only).
- D23 (build): a project is a folder whose `topology.ts` has a default export, not under `modules/` or `node_modules/` (the compiler's `projectDirs` rule); at a folder holding none, every project under it is in scope. R1100 counts `packages/<name>/` unless its `package.json` names a package outside `@keel/`, so a team's own `packages/` folder is no framework.
- D24 (build): R1053 passes `` import(`./<dir>/${x}.ts`) ``, a template starting `./` or `../` and ending in a file extension, and `new Worker(new URL('<literal>', import.meta.url))`: both are bundler forms bounded to files beside the importer, and std.messages' `load` is the first. It fired on golden-2's two message sets.
- D25 (build): in a range R1101 and R1102 report only an entry absent at `<base>`, as `new`; under `--all` each standing entry. The lockfile reads are `pnpm-lock.yaml` `resolution:` with more than `integrity`, and `resolved` not `https:` in `package-lock.json` and `yarn.lock`; pnpm 11's `pnpm-workspace.yaml` `overrides`, `patchedDependencies`, `onlyBuiltDependencies` and `allowBuilds` are read beside `package.json`'s fields.
- D26 (build): the readers live in `@keel/cli/review`, a lazily loaded entry, not in `@keel/check`. Rejected: a new `@keel/check` entry for readers no rule uses, which adds public surface for one caller.
- D27 (build): a server file is named `*.server.*` or `*.guard.*`; the CI job runs `pnpm exec keel review origin/${{ github.base_ref }}..HEAD` under `if: github.event_name == 'pull_request'` after a full-history checkout and a frozen install.
- D28 (build): the R1052 clause names the four folded forms without quoting a directive, since the structure lint (S0004) reads a test's `// Spec:` header as a comment. A conformance change updates `review-r1052.test.ts`'s header and title to the new text.
- D29 (build): the cli's test timeout is 120 s: the review conformance starts the binary about 80 times in one test, half a second each.
- D30 (build): the two holes found in existing protections. The ledger's `unsafe` count now reads a standalone app's `modules/` (`buildLedger`). An app file under `unsafe/` with no `unsafe(` call is R1058 (high) in review; one that holds a call is R1001 and lifts the folder's rules for the whole file, which review lists but does not split (backlog 1026).

## Problem
Keel is written for agents to build apps with. Often no person designs the app, writes its code or reads the diff, so the framework has to do the right thing by default, and for the most part it does: `keel check` refuses ambient effects, casts, internal imports and undeclared origins, and the content security policy refuses what the checker misses.

Two kinds of escape remain. The framework sanctions some on purpose, each with a name: `unsafe(reason, fn)`, a declared third-party origin, `reveal`, a mounted identity handle, `KEEL_ALLOW_ORIGINS`. And because an app is TypeScript, anything the checker reads by syntax can be written in a shape it does not read. An agent told to make the build pass will find that shape. Four cases from this repository's own agent work in the week of this RFC:
- a TypeScript suppression directive assembled by joining strings, so the lint that reads comments saw none;
- an import specifier built by `["vi","test"].join("")`, so the structure lint saw no dependency edge;
- an app agent patching `@keel/compiler` so its app would build;
- a conformance fixture bent until the suite passed.

No tool an app runs refuses any of them. A person reading the diff can, and that person is the safeguard this framework cannot assume. An app's author may not know what to look for, or how to steer the agent away from it.

What is missing is a report, as loud as the danger and louder when the escape is new in this change, of every place the code opts into danger, goes around a protection, or uses an unsafe or private API. The groundwork below counts the ways out and what catches each one today.

### The gap
Verified against `packages/check/src/rules/`, `packages/cli/src/internal/`, `packages/scaffold/src/templates/` and `tooling/` at `efbd2bca`. "App" means a run of `keel check`, `keel test`, `keel build`, `keel ledger` or `keel evidence` in an app catches or lists it; "repo" means only this repository's tooling does; "partial" names what passes.

**Sanctioned opt-ins.** A rule may constrain the form (a reason string, an allowed value); the column that matters is whether anything lists the opt-in for a reader.

| # | opt-in | constrained by | listed for a reader | where |
|-|-|-|-|-|
| O1 | `unsafe(reason, fn)` | E1754 (reason) | repo: the ledger's `unsafe` count reads `packages/*/{src,unsafe}` and `apps/<app>/**`; a standalone app's `modules/` counts 0 | `buildLedger.ts:25,97` |
| O2 | declared origin (`origins` in `topology.ts`) | E1590, E1591 | app: `security.json` of `keel evidence` | k.evidence |
| O3 | `KEEL_ALLOW_ORIGINS`, `createApp({ allow })` | E1560 (`*`, a path) | nothing | k.hosting |
| O4 | `reveal(secret)` | E1105, E1112, E1113 | nothing | k.reveal |
| O5 | `clientPii` in a manifest | E1107 | nothing (`pii.json` lists `.pii()` paths, not `clientPii`) | k.leave |
| O6 | std.sessions `expose`, `readers` | E2001 | nothing | std.sessions |
| O7 | identity `handle` (raw `Response`, `set-cookie`) | E1579 to E1581 | nothing | k.user |
| O8 | `identityMount(path, { links })` | E1584 | nothing | k.mount |
| O9 | `service({ base })` to an outside host, `KEEL_PEER_<NAME>` | E1571 (client code) | nothing | k.services |
| O10 | API route `bearer` | nothing | nothing | k.api |
| O11 | a route or action with no guard | E1508 (form only) | nothing | k.guards |
| O12 | `Host`, `hostCode`, `customElement` | E1824, E1802, E1825 | app: the ledger's `hostElements`, E1706 under `keel ledger --diff` | k.host-element |
| O13 | a password control on a plain string | W1114 | app: printed on every `keel check` | k.privacy-reads |
| O14 | std.postgres `fragment` (spliced text) | E2457 (values) | nothing | std.postgres |
| O15 | dev inspect origins (`KEEL_INSPECT_ORIGINS`) | none | nothing | k.cli |
| O16 | an `http:` `KEEL_ORIGIN` in a shell | E1574 | app: the policy in `security.json` | std.capacitor |

**Workarounds.**

| # | workaround | caught by | runs for an app | where |
|-|-|-|-|-|
| W1 | cast, `any`, `!`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` in app code | E1757 | app | `noUnsafeSyntax.ts` |
| W2 | the same in tests, `.d.ts`, `*.config.*`, `unsafe/` | biome `noExplicitAny`, `noNonNullAssertion` in this repo; casts by nothing | repo | `isAppPath.ts:10` |
| W3 | `eslint-disable`, `biome-ignore`, `oxlint-disable` | nothing | none | |
| W4 | a suppression directive assembled from strings | nothing: E1757 reads comments | none | |
| W5 | a computed or assembled specifier: `import(x)`, `[...].join("")` | E1603 only for `data:`/`blob:`; E1576 reads literals | none | `moduleSpecifiers.ts:26` |
| W6 | `require` | E1759 | app | `noNodeGlobal.ts` |
| W7 | a `@keel/*` `internal` entry, a `#` specifier | E1576 (literal) | app | k.security |
| W8 | a deep import (`@keel/x/src/...`, a path into `node_modules/@keel`) | only when the `exports` map refuses it (E1751) | partial | |
| W9 | `fetch`, timers, storage, `Date`, random | E1601 (literal keys) | app | `noAmbientCapability.ts` |
| W10 | a global by an assembled key, `globalThis['fe' + 'tch']` | nothing | none | `noAmbientCapability.ts:59` |
| W11 | `document`, `window`; `innerHTML` and its family | E1252; E1002 | app | |
| W12 | `eval`, `new Function` | E1603 | app | |
| W13 | `process.env`, `fs`, `child_process`, `net` in a `*.server.ts` or test | E1759 reads browser files only | none | `noNodeGlobal.ts:89` |
| W14 | an app file under `unsafe/` with no `unsafe(` call | nothing; the folder lifts E1757, E1601, E1252, E1603 | none | `isAppPath.ts:10` |
| W15 | an edit to framework source: `packages/<kernel>/` from an app change, `node_modules/@keel/` | nothing | none | |
| W16 | `pnpm.overrides`, `patchedDependencies`, `patches/`, tracked `node_modules` | nothing (`deps.json` records integrity) | none | `depsReport.ts:49` |
| W17 | a lockfile entry moved to a git, tarball or `file:` source | nothing | none | |
| W18 | `preinstall`, `install`, `postinstall`, `prepare` scripts | nothing | none | |
| W19 | an edited generated deploy file (CI, Dockerfile, compose) | E1005 freshness | app | `deployFreshness.ts` |
| W20 | an edited `.keel/` or committed `dist/` file | nothing (regenerated) | none | |
| W21 | `.only` | vitest's own CI default | partial | |
| W22 | `.skip`, `.todo` | `keel test` counts skipped and passes | partial | `testCommand.ts:82` |
| W23 | a weakened or removed assertion | mutation score E1713 under `keel ledger --diff` in this repo | repo | `ledgerCommand.ts:223` |
| W24 | an edited conformance suite | S0008 | repo | `conformance-guard.mjs` |
| W25 | changed tsconfig, lint, vitest or Vite configuration | nothing reports the edit (`keel check`'s type pass ignores the app's tsconfig) | none | `tsCompilerOptions.ts` |
| W26 | an edited CI workflow or git hook not generated by Keel | nothing | none | |
| W27 | a lowered budget or ledger rung | `tooling/budgets.mjs`; E1706 under `keel ledger --diff`, which the scaffold's CI does not run | repo | `ciWorkflow.ts` |

**Count.** 43 ways out: 16 opt-ins, 27 workarounds. For an app today 11 are caught or listed (4 opt-ins listed, 7 workarounds caught) and 3 more partly; 5 only in this repository's tooling; 24 by nothing. Of the four cases above, W4, W5 and W15 are caught by nothing in an app, and W24 only here.

## Proposal
### Command (k.review Command)
```
keel review origin/master..HEAD        # a range: what this change adds, changes, keeps
keel review --all                      # the whole tree: every escape, novelty standing or accepted
keel review apps/shop --all            # one project of a monorepo
keel review --accept <id> --reason "…" # a person accepts one finding into keel-review.json
```
- The scope is each project (a folder holding `topology.ts`) under the given paths, default the working directory's, plus the git root's repository files: `package.json` files, the lockfile, `.github/`, `.githooks/`, `patches/`.
- A range reads both ends from git objects (`git show <rev>:<path>`, renames by `git diff -M`); the working tree is not read. `--all`, the default, reads the working tree, git or not, and every finding is `standing` or `accepted`.
- The command makes no network request and runs no project code. Under one tree and one range two runs print byte-equal output.
- It reads every tracked file in scope. Exemptions `keel check` makes for app code do not apply (D9).
- Output follows OUTPUT.md; a finding is a `review` record (Output).

### Finding model
Each finding has: `code` (R), `path:line:col` at `<head>`, `message` under 90 characters, `protection` (the spec id of what is opted out of or gone around, `k.security`, `k.privacy`, `k.ctx`), `opt` (true for an opt-in, false for a workaround), `danger`, `novelty`, `loud`, `id`, and `reason` when the escape carries one (an `unsafe` string, an origin's reason).

`id` is the first 12 hex characters of the SHA-256 of the code, the path (following renames), and the escape's source text with whitespace collapsed, with an ordinal among equal texts in the file. Moving lines does not change it; changing the escape or its reason does.

### Danger
Assigned by what an attacker or a mistake reaches through the escape, the highest that applies:
- **critical**: code that runs with the app's authority without passing the review, or the review itself. The supply chain (W15 to W18), framework source and private entries (W8, W15), code from strings and child processes, every evasion form (W4, W5, W10, an unreadable file), and changes to the review's, check's, test's, type's or CI's configuration (W25, W26, the baseline).
- **high**: user data, secrets, or the trust boundary of a request. `reveal`, CORS (O3), a raw handle (O7), `clientPii`, sessions `expose`, a `connect` or `frame` origin, direct `process.env`, `fs`, network access on the server (W13), an `unsafe/` file without `unsafe(` (W14), an edited generated file (W19, W20), a lowered budget or rung.
- **medium**: what a check or test proves. A cast, `any`, `!` or suppression where `keel check` does not read (W2, W3), a skipped or focused test, a weakened assertion, `unsafe(reason, fn)`, `Host`, `links`, `bearer`, `fragment`, a service base to an outside host.
- **low**: a contained opt-in: an `img`, `media` or `font` origin; a dev inspect origin.

Each code's level is fixed in k.escapes; a level never depends on the text it reads. The opt-ins named here with no code in 1.0 (`clientPii`, sessions `expose`, `Host`, `links`, `bearer`, `fragment`, a service base, a dev inspect origin, a lowered budget or rung) take these levels when their codes are added (D11).

### Novelty
Findings at `<base>` and `<head>` are matched by `id`:
- `new`: at `<head>` only.
- `changed`: at both by code and path but with another `id`, matched by the nearest `id` at `<base>` of that code and path; a changed `reason` is `changed`.
- `standing`: the same `id` at both.
- `accepted`: `standing` and its `id` is in `keel-review.json` at `<base>`.

Under `--all` there is no base: every finding is `standing` or `accepted`.

### Loudness
| danger | new | changed | standing | accepted |
|-|-|-|-|-|
| critical | fail | fail | fail | count |
| high | fail | fail | warn | count |
| medium | warn | warn | list | count |
| low | list | list | list | count |

A sanctioned opt-in (`opt: true`) takes the step below the table's (`fail` to `warn`, `warn` to `list`; `list` and `count` stay). So a new `unsafe('the chart library mutates its canvas', …)` prints as a warning for a person to read; a new `["@ts", "-ignore"].join("")` fails.

- **fail**: printed first, grouped by code; the command exits 1.
- **warn**: printed after `fail`.
- **list**: printed with `--list`, always in json.
- **count**: in the trailer only; json lists them with `--list`.

Exit: 0 when no finding is `fail`; 1 when one is; 2 on a usage error. `--fail-on warn` makes `warn` exit 1 too, for a CI that wants every new escape read before merge.

### Baseline (k.review Baseline)
`keel-review.json`, beside `topology.ts`, or at the git root for findings outside any project:
```json
{ "v": 1, "accepted": [{ "id": "3f2a9c01d2e4", "code": "R1001", "path": "modules/charts/unsafe/canvas.ts", "reason": "the chart library writes its canvas; the input is a parsed Series" }] }
```
- Read at `<base>` for a range, the working tree under `--all`. An entry added in the range silences nothing in that range: a new escape is read by a person in the change that brings it, and its acceptance takes effect from the next.
- Every edit to the file is R1105 at `critical`, so an acceptance added alongside its escape fails the range that adds both. A team that wants to accept and merge in one change runs the acceptance as its own change first.
- An entry whose `id` matches no finding is R1151 (`list`). A finding whose `reason` was removed or edited has a new `id`, so it is no longer accepted: it reads `changed`, at its full loudness.
- `keel review --accept <id> --reason "<text>"` adds one entry; `reason` is required, 10 to 200 characters (E1067). The file is for people: the skill never runs `--accept` (Skill).
- Not the ledger: the committed ledger must equal what `keel ledger` produces from the tree (S0011), and the baseline is a human input. Not the evidence bundle: a bundle is a dated output. Later (D11) the bundle gains `review.json`: the accepted entries and the counts by level.

### Evasion
Static review cannot be complete. The design makes evading it leave a mark of its own:
- Every shape that hides a reference is a finding whether or not it hides anything: a string whose value, folded from literals, `+`, template literals, `.join` and `String.raw` of literal arrays, starts with `@ts-`, `eslint-disable`, `biome-ignore` or `oxlint-disable` (R1052); a module specifier that is neither a string literal nor a template without `${}`, in `import()`, `require`, `new Worker` or `import.meta.resolve` (R1053); a member of `globalThis`, `window`, `self` or `global` whose key is not a literal, and an indirect `eval` (R1056).
- Every change to what decides what passes is `critical` (R1103 to R1105): the baseline, check, type, lint and test configuration, `package.json` scripts and `pnpm` fields, CI workflows, git hooks.
- The review reviews the change to protections as well as the code: an edit to framework source in the same range as an app's (R1100), an edit under a `conformance/` folder (R1061), a deleted test file or fewer assertions in one (R1060), fewer `.pii(`, `s.secret(` or `guard(` calls in a kept file (R1108), and an edited generated file under `.keel/` or `dist/` (R1107).
- What the review cannot read is a finding: a tracked code file in scope that does not parse (R1150).
- CI runs `keel review` from a clean install of the lockfile at `<head>`; an install that changes `@keel/cli`'s source is R1100 or R1101 in the range that does it.

What it still does not see is stated in k.review Limits: code that reaches a capability through a value passed in from another file, an escape inside a dependency's published code, behavior that depends on runtime data, a test that asserts the wrong thing at full strength.

### Tool and skill
The command decides what a rule can decide: where an escape is, what it reaches, whether it is new. The skill `keel-escapes` (`packages/cli/skills/keel-escapes/SKILL.md`, at most 2,500 tokens, copied to `.claude/skills/` by docs-check D0013) does the reading a rule cannot:
1. Run `keel review <base>..HEAD --format=json --list`. Take every `fail` and `warn`.
2. For each: read the code and the diff around it. Answer four questions in one line each: Is there a Keel seam for this (the skill's table maps each R code to the seam: R1057 `process.env` to `DeployEnv` and `ctx`, raw `fetch` to `service`, a `globalThis` lookup to the `ctx` capability)? Does the reason name the guarantee given up and why this use is safe? Was a test, assertion, fixture or configuration changed to make something pass? Is this the Keel way (PRINCIPLES 1, 2, 10)?
3. Write a report: per finding `replace with <seam>`, `keep: <why>`, or `needs a person: <question>`, then the `accepted` and `count` totals and the review's stated limits.

It must never: approve a range or say it is safe to merge; run `--accept` or edit `keel-review.json`; edit review, check, lint, test or CI configuration; reshape code so a finding disappears without removing the escape (moving it into `unsafe/`, into another file, behind a helper); delete or weaken a test to clear a finding. An agent may run the skill on its own work and fix what it finds by replacing the escape with the seam; acceptance is a person's.

### Where it lives
- **Sections**: k.review (the command and the finding model) and k.escapes (the codes), both new and `proposed`, owned by `@keel/cli` (`tooling/docs-owners.json`). Neither fits an existing section: k.cli is at 1,496 of the 1,500 tokens `keel docs k.cli` may print (k.cli Conformance), k.check at 1,540 of 1,875, and the two texts together are 2,400 tokens (D18).
- **Package**: `@keel/cli` holds the command, git reads, matching, the baseline and output. The code readers sit in `@keel/check` beside the ones they extend (`moduleSpecifiers`, `globalRefs`, `noUnsafeSyntax`'s comment read), as internal modules the CLI imports. No new package and no new extension point. Later (D11), a stdlib `./tools` entry registers R2xxx findings through `defineRule` (k.check Registry), `defineRule` accepting `R2\d{3}` beside `[EW]2\d{3}`.
- **Codes**: R is unused (OUTPUT.md Tooling codes takes B D E F H I M O S T V W). E1065 to E1068 are free in k.cli's E105x block, which the map gives k.review too.
- **Relation to `keel check`**: unchanged and still the gate for correctness. Review does not repeat a finding `keel check` reports as an error in the same place; it reports E1757's forms where `keel check` does not read (D9) and the opt-ins `keel check` constrains but never lists.
- **Relation to `keel evidence`**: unchanged in 1.0; `review.json` in the bundle is later (D11).
- **CI**: the workflow k.deploy generates gains one `review` job on a pull request, beside the per-deployable `keel check`, `keel test` and `keel build` jobs (D17, D19).
- **MCP**: `review` is an operation, so `keel mcp` serves it as a tool (k.cli One engine). LSP is unchanged: it serves check diagnostics.

### In 1.0 and later
| when | holds | size |
|-|-|-|
| 1.0 | k.review and k.escapes; the command over a range and `--all`, one app or a monorepo; findings, novelty, loudness, exit and `--fail-on`; the baseline at `<base>`, `--accept`; R1001, R1010 to R1012, R1014, R1050 to R1053, R1055 to R1061, R1100 to R1105, R1107, R1108, R1150, R1151; E1065 to E1068; the generated CI's `review` job; the `keel-escapes` skill; `keel explain` rows | about 1,900 lines of source and tests across `@keel/cli`, `@keel/check` and `@keel/scaffold`'s CI template, 17 conformance clauses, one skill; one lane, three days |
| later | the opt-ins no evasion depends on: `clientPii`, `links`, a service base, `Host`, sessions `expose` and `readers`, `bearer`, an unguarded action; a lowered budget or rung; stdlib R2xxx through `defineRule` (std.sessions, std.postgres `fragment`); a matcher table for weakened assertions (`toEqual` to `toMatchObject`, `toBe` to `toBeDefined`); `review.json` in the evidence bundle | about 900 lines, 8 clauses, changes to k.check Registry and k.evidence; one lane, two days |

The 1.0 set catches all four cases in the Problem: R1052, R1053, R1100 and R1061.

## Alternatives
- **More `keel check` rules.** Each workaround as an E code in app code. Rejected: check reads one file at a time with no history, so it cannot say new or standing, cannot see the supply chain or configuration, and a check that fails on every sanctioned opt-in punishes the sanctioned path. Under the provisional freeze a new E code also fails existing apps.
- **W codes from `keel check`.** Advisory, never fail. Rejected: a new assembled directive must fail CI; a warning drowns among standing ones.
- **E and W codes for findings, the exit decided by a flag.** Rejected: `keel explain`, `isError` and every reader of the output take `E` to mean the run failed (OUTPUT.md); a standing `unsafe` call would print as an error that does not fail.
- **A linter (biome, eslint) shipped to apps.** Rejected for this job: a linter's own suppression comment is the first workaround (W3), it has no range, and it adds a second toolchain (PRINCIPLES 1).
- **The baseline in the ledger.** Rejected: the ledger is generated (S0011); an accepted escape is a person's decision.
- **The baseline read at `<head>`.** Simpler. Rejected: the change under review could accept its own escapes.
- **Danger from a score (CVSS-like).** Rejected: four levels with one rule each are testable; a score is a judgment the skill makes.
- **Only a skill, no command.** Rejected: an agent asked to review its own work reads what it chooses; the command reads every file the same way every time, and its output is what the skill starts from.

## Spec diff
Applied in this commit:
- **New `spec/kernel/k.review.md`** (status `proposed`): Purpose; Command; Findings (the `review` record, `id`); Danger; Novelty; Loudness (the table, the opt-in step, output, trailer, exit); Baseline; CI (the generated `review` job); Limits; Rules E1065 to E1068; Conformance, eight clauses.
- **New `spec/kernel/k.escapes.md`** (status `proposed`): Purpose (test file and server file defined); Codes, the 26 R codes with danger and reach; Range codes; Rules; Conformance, nine clauses.
- **k.cli** (status unchanged): Commands gains `review [range | --all]`; kernel record kinds gain `review`; Output drops its sentence on the default mode, which OUTPUT.md Mode states (D15).
- **k.deploy** (status unchanged, D19): the CI workflow bullet gains "one `review` job on a pull request (k.review CI)".
- **Map**: rows for k.review and k.escapes after k.parity; Code ranges names R1xxx (k.escapes); block E105x gains k.review.
- **docs/GLOSSARY.md**: **escape**.
- **docs/OUTPUT.md**: Tooling codes gains the R letter, whose exit follows loudness; record kinds gain `review` with its shape and compact line.
- **Ledger**: k.review #1 to #8 and k.escapes #1 to #9 in `tooling/ledger/ledger.json` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0178`, from the spec text alone: `packages/cli/conformance/review.test.ts` (k.review 1 to 8) and `packages/cli/conformance/escapes.test.ts` (k.escapes 1 to 9), on fixture repositories made with `git init` in a temporary folder, a fixture and its clean twin per code under `packages/cli/conformance/fixtures/review/`. k.review 8 (the CI job) reads the workflow `keel build` writes for a fixture, as k.deploy's CI clauses do. Spec topics: `pnpm spec k.review`, `pnpm spec k.escapes`; for context `pnpm spec k.check`, `pnpm spec k.security`, `pnpm spec k.origins`, `pnpm spec k.deploy`, `pnpm spec k.boundary`.

## Build
- `@keel/check`: internal readers `foldedString` (R1052), `computedSpecifiers` (R1053, beside `moduleSpecifiers`), `computedGlobals` (R1056, beside `globalRefs`), and the comment read of `noUnsafeSyntax` taking any path (R1050).
- `@keel/cli`: `reviewCommand.ts` (the operation and flags), `gitRange.ts` (two revisions and renames from `git` with `-z` output, beside `gitSource.ts`), `reviewFindings.ts` (per file and per repository file), `matchFindings.ts` (novelty), `loudness.ts`, `baseline.ts` (read, `--accept`), a `review` formatter, `EXPLANATIONS` rows for each R code and E1065 to E1068.
- `@keel/scaffold`: the CI workflow template's `review` job; golden-1's and golden-2's workflows regenerated (E1005).
- Tooling: the code patterns of `tooling/docs-check.mjs` (D0009, D0015) and `tooling/docs-pack.mjs` read `R` beside `E`, `W` and `I`, so `keel docs --for R1053` finds k.escapes.
- `packages/cli/skills/keel-escapes/SKILL.md`, its copy under `.claude/skills/`, a line in the `keel` skill's command list.
- Docs: `docs/THREAT-MODEL.md` (what review sees and does not), the cli README.

## Known limits
- Static and per file: an escape built across files (a helper that returns `globalThis`, a specifier passed as a parameter) shows as R1053 or R1056 where the computed part is, not where it is used.
- Danger is per code; a `reveal` that goes to a hash and one that goes to a response are both `high`. The skill reads which.
- The baseline cannot prove a person wrote an entry. Reading it at `<base>` means it took a merged change to write it; who may merge is the repository's rule (a protected branch, a code owner on `keel-review.json`).
- R1100 reads a kernel change and an app change in one range as a workaround. In this repository a kernel RFC that also updates a golden app has that shape and fails review; the orchestrator reads the finding on merge (D14).
- R1052 also reads a tool's own pattern strings, such as the suppression comments `noUnsafeSyntax.ts` looks for; in this repository each such file is accepted once.
- The ledger's `unsafe` count reads 0 for a standalone app (`buildLedger.ts`, `ROOT_APP` counts hosts only); that is a ledger bug for its own backlog line, and R1001 lists the calls regardless.

## Migration
None: unreleased.

## Token impact
k.review 5,117 characters (1,280 tokens), k.escapes 4,489 (1,123), each under the 1,875 section budget. k.cli 5,963 to 5,969 characters; `keel docs k.cli` prints 1,496 tokens of its 1,500. k.deploy 6,358 to 6,408. Map 5,468 to 5,616 characters: two rows, a code-range clause and a block owner; `spec.map` is re-based from 1,370 to 1,405 and `docs.map` (the installed map `keel docs` prints) from 1,410 to 1,430, since a section added to the kernel is a row in its map. GLOSSARY gains one entry; OUTPUT.md one sentence and one record shape. The `keel-escapes` skill stays under 2,500 tokens; each explain row under 120.

## For the owner
The decisions to confirm or reverse are D12 to D19 above; each names the alternative rejected. D13 (the baseline at `<base>`) and D17 (the CI job fails only on `fail`) shape how teams use the command most.
