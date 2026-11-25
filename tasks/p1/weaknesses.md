# P1 weakness triage

Every unchecked line of `tasks/BACKLOG.md` has one disposition here, decided by the engineering lead under the operator's delegation (W2 steps 1 and 2 of `tasks/p1/PLAN.md`, decision O1). The standard: Keel goes public hardened, tested well enough that a serious outside engineer, auditor or first user finds no false claim, loses no data, is not misled and is not locked out. A wrong diagnostic, a flaky gate, a silent failure, a scaffold that does not build and a doc that lies are weaknesses; a cosmetic nit is not. No kernel or std feature leaves 1.0: a line that finishes a 1.0 feature is A work, never C.

| List | Lines |
| --- | --- |
| A1 Before public, fix now | 102 |
| A2 Before public, after A1 | 105 |
| B Docs sweep (W12 step 4) | 24 |
| C After public, in `tasks/FUTURE.md` | 7 |
| D Closed now | 52 |
| H Needs a human | 2 |
| Total | 292 |

Lists A1, A2, B and H hold the open lines, unchecked; C and D are checked here and in the backlog. Verify that every open backlog id appears exactly once, and the counts:

```sh
diff <(grep '^- \[ \]' tasks/BACKLOG.md | cut -c7-10 | sort) \
     <(grep -E '^- \[ \] [0-9]{4} ' tasks/p1/weaknesses.md | cut -c7-10 | sort) && echo same
grep -E '^- \[[ x]\] [0-9]{4} ' tasks/p1/weaknesses.md | cut -c7-10 | sort | uniq -d
for s in A1 A2 B C D H; do awk -v s="$s" '/^## /{n=$2} n==s && /^- \[[ x]\] [0-9]{4} /' tasks/p1/weaknesses.md | wc -l; done
```

Rules:
- A1 is correctness, security, privacy, a11y, data, false claims, gate reliability, the scaffold and first run, missing conformance, and anything an auditor or a newcomer meets. A2 is a real defect of lower stakes, or a tooling rough edge that slows the team.
- A lane is one builder in one sitting. Lanes run in their order; at most two test-running lanes at once, one mutation run at a time. RFC means a spec or kernel behaviour change; a fix against the spec needs none. A conformance file changes only in an `rfc:` commit by the conformance-writer.
- Sizes: S fits in an hour, M in half a context window, L in a whole one.
- Where a line asks the operator for an engineering call, the call is made here (`decided:`) and the lane builds it; the operator may reverse it.
- In flight now, in no fix lane: 1102 (its own lane); RFC 0163, the library format and k.parity (0953, 0998); the `unsafe` count and the negative type fixtures; the RFC status lines.

## A1 Before public, fix now

### Lane 01 gate-flakes · tooling, cli, check · no RFC · L
- [ ] 1040 root `pnpm test` under load needs several whole runs; name every failure
- [ ] 0938 a cold parallel `pnpm test` fails one task in three runs
- [ ] 0762 root test flakes under load; the quiet output hides failed tasks
- [ ] 0515 vitest main, Stryker core and `keel dev` servers outlive the watchdog
- [ ] 0417 E1155 conformance case failed once under load
- [ ] 1004 one `packages/cli` test fails now and then under load
- [ ] 0868 the browser resume smoke crashed once, cause unknown
- [ ] 1103 `canary.mjs` fails six steps under load; evidence bundle not written
- [ ] 1003 the CI smokes are not part of the local pre-push gate
- [ ] 1105 `mutate.mjs --stop` waits without a bound; a run blocked in `open()` holds the lock

### Lane 02 conformance-files · testing, scaffold, check, std-schedules, runtime-dom, compiler · `rfc:` conformance commits only · M
- [ ] 1098 `sim-stalls` real 100 ms timer against a 300 ms budget is load-sensitive
- [ ] 0464 `topology-deploy-files` takes 18.6 s and times out under load
- [ ] 0996 check fixture conformance passes only when started in `packages/check`
- [ ] 0514 a failing `next-fire` property shrinks for hours; cache the matcher
- [ ] 1041 resume with `mode: "dev"` still has no conformance case
- [ ] 1032 `shell-entry-mount` carries a stale `SKIPPED` header
- [ ] 0580 neither a11y agreement file has a labelled `Box as="nav"` case

### Lane 03 ledger-integrity · cli (ledger), tooling · RFC (k.ledger, 0719) · M
- [ ] 0719 ledger clauses keyed by position, so `--diff` compares different clauses; decided: key by clause text
- [ ] 0999 the golden apps' `keel test` rewrites committed `surface.json` in a clean checkout
- [ ] 0992 nothing checks that a conformance `// Spec:` quote appears in its section
- [ ] 1054 `mutate-justified` reads apps, the ledger reads `packages/` only; decided: the ledger reads apps (with 0919)
- [ ] 1112 the ledger counts an unskipped test as passing without a run result

### Lane 04 store-backed-flakes · std-db, std-postgres, apps/golden-2, apps/household · no RFC · M
- [ ] 0651 the PGlite vitest worker dies with a V8 fatal error under load
- [ ] 1039 a vitest worker crashed twice in the std-postgres suite
- [ ] 1064 std-db `serial-commits` property failed once during a mutation run
- [ ] 1058 golden-2 `racing-recipes` failed once; find the race or bound it
- [ ] 1073 household `keel test` ended once in a Node crash trailer

### Lane 05 first-run · scaffold, compiler, cli, every package's publish config · RFC (k.cli, 1012) · L
- [x] 0991 the scaffold omits `esbuild`, so a new project's `keel build` fails
- [ ] 1005 packages export `src/*.ts` while `files` is `dist`; published packages break
- [ ] 0414 a scaffolded project has no `node` deployable, so `route --api` is E1511
- [ ] 0677 a scaffolded module is placed in no deployable; the API route misfits writes
- [ ] 0378 golden-1 hand setup leans on the repo root; export the reporter from `@keel/testing`
- [ ] 1012 `keel check --quiet` hides the failing code; decided: a failing quiet trailer names the first code

### Lane 06 server-scrub-and-streams · server, services · RFC (k.privacy, 0974) · L
- [x] 0970 URL copies of a secret from common encoders slip the scrub; match a decoded view
- [x] 0971 hex, `\/`, entities, NFD and unaligned base64 copies slip; decided: add what matches cleanly, state the rest as limits
- [x] 0974 the whole-text mark and the covered encodings are stated in the README only
- [x] 0756 a secret starting or ending with `/` leaves the slash in the `req` line
- [x] 0729 the scrub costs 1.2 s of event loop on a 790 KB body, a cheap stall
- [x] 0972 non-ASCII secrets reach the scrub's cap about 2.2 times sooner
- [x] 0442 plain siblings of an `s.secret` drop from a 422 re-render; restore and re-base the budget
- [x] 1001 an event stream has no cap on one event's size, server or client

### Lane 07 check-security-rules · check, cli · RFC (k.boundary, 0884) · M
- [x] 0975 E1111 misses aliases, destructured `assign`, reassigned `let`, cross-file changes
- [x] 0884 `/// <reference types="vite/client" />` passes; decided: forbid it, type `import.meta.env` through a Keel declaration
- [x] 0880 E1107 keeps its own client reach instead of the shared one
- [x] 0994 `declaredFor` follows relative imports only, so an alias skips E1570
- [x] 1101 E1108 can accept in an editor what a fresh `keel check` refuses
- [x] 1099 E1571's message reads two ways; reword within 89 units
- [x] 0995 `linkEscapes`, behind E1357 and E1585, has no unit or property test

### Lane 08 router-identity · router, check (E1584, E1580), compiler (E1579) · RFC (k.opening, 0969) · M
- [x] 0968 an admitted return link re-arms the gate through app code
- [x] 0969 a failed `record` leaves the older opening; state it in k.opening
- [x] 0976 an `identityMount` call outside `identity.ts` adds unchecked mount paths
- [x] 0336 `navigate` with `\` gives `//x`; `settle` spins on a sim clock; locale and `issueText` leads
- [x] 0314 after a titled server-rendered first page, untitled pages keep that title
- [x] 0895 `handle.path` `/assets` shadows built assets and E1579 allows it

### Lane 09 pii-and-data · std-sessions, schema, std-channels, store, docs (THREAT-MODEL) · RFC (k.schema 0980, std.channels 0973) · M
- [ ] 0977 `redact` skips an open object's undeclared keys, so personal data stays recorded
- [ ] 0980 a `Secret` in a `Map`, `Set` or symbol key under an undeclared key parses; decided: refuse non-JSON values there
- [ ] 0973 one cookieless client opens 64 streams per module; decided: a process-wide anonymous count
- [ ] 0748 THREAT-MODEL does not name `keys` in `#k-state`; `openHub` re-derives keys

### Lane 10 offline-and-live-data · std-offline, std-live, apps/golden-1 · RFC (std.offline, 0800) · M
- [ ] 0800 two tabs overwrite each other's stored outbox and lose queued writes; decided: per-tab keys
- [ ] 1025 golden-1 opened first while offline says "Not found"; decided: an offline state from std-offline's status
- [ ] 0806 std-live aborts a read's signal on dispose after the read settled

### Lane 11 dev-loop · cli, compiler · RFC (k.compat 0461, k.topology 0400) · L
- [ ] 0400 a `keel dev` failure is an unstyled 500, and k.topology claims HMR; decided: the spec says full reload, HMR stays in FUTURE
- [ ] 0461 `surface.json` goes stale in dev, so `keel check` reports E1005 until a build
- [ ] 0340 the surface builder lives in the cli binary; an MCP build writes none
- [ ] 0343 `keel dev` with a client and a node deployable resumes no node islands
- [ ] 0908 an unmatched path answers Vite's 404 in dev, Keel's in a build
- [ ] 0955 a dev reload keeps a removed inspector section; `s.register` fails on edit
- [ ] 0520 `server.port: 0` gives a false E1560; decided: skip the probe, report the bound port

### Lane 12 runtime-ids · runtime-dom, ctx, testing · RFC (k.runtime, k.ctx) · M
- [ ] 0282 binding ops take `data.at` from the element's `id`, which may be app data
- [ ] 0997 `createRoot` adds seven capture listeners that no spec sentence states
- [ ] 1096 a hold settling after its run's `stop` runs on the dead run

### Lane 13 a11y-harness · testing, std-headless, std-widgets · RFC (k.testing) · M
- [ ] 0989 `fire` sends one event, so a widget with no `onClick` passes; add a real click
- [ ] 0990 no conformance states that a press selects a tab; audit every widget's pointer path
- [ ] 0573 harness `click` moves no focus; `th scope=row` role; no `aria-rowindex` state key
- [ ] 0317 harness `find` exposes no `lang` and no stable node handle

### Lane 14 silent-compiler · compiler, check, apps/sessions · RFC (k.bundle 1093) · M
- [ ] 0602 a non-literal style value on a base element is dropped with no diagnostic
- [ ] 0578 a component called as a function in JSX renders nothing, silently
- [ ] 0601 the sessions app's hand-built `Box` calls ship classes with no CSS
- [ ] 1093 the service map does not follow `new URL(...)` or `?worker`; decided: the scan follows both
- [ ] 1007 an app module with a contract and no `routes.ts` serves 404s silently; decided: E1586 reaches app modules

### Lane 15 spec-claims-and-explain · check, cli, spec, std-i18n, std-messages, std-sessions, std-postgres · RFC (k.ui 1051, k.check 1014) · M
- [ ] 0978 `keel explain` answers nothing for codes a section states; add a check
- [ ] 0318 `keel explain` has no entry for E2301 and E2401 to E2406
- [ ] 0485 `keel explain` has no entry for E2002 to E2004
- [ ] 1051 k.ui says E1801's fix is the nearest token; no fix is offered for a look
- [ ] 1033 E2460 is explain-only while std.postgres lists it among the `/tools` rules
- [ ] 0979 some std sections have no row in the spec map or the std table
- [ ] 0855 E1759's clause for a project with no `topology.ts` would report Node tooling
- [ ] 1014 `keel check` reads every `.js` and `.mjs`; decided: k.check names app code as modules, root config and tests

### Lane 16 spec-size · tooling, spec · RFC (principle 8 bound, the section splits) · M
- [ ] 0981 k.module is over its 6,000-character limit and the budgets gate passes
- [ ] 0807 `keel spec` and `tooling/budgets.mjs` measure a section differently; make them one
- [ ] 1100 the spec map plus the largest section is over principle 8's 4,000 tokens; decided: a section bound that keeps the sum under it
- [ ] 1043 std.postgres is about 3,065 tokens; split it with 1100

### Lane 17 shells-proof · std-tauri, apps with `identity.ts`, CI shell jobs · no RFC · L
- [ ] 0958 the return-link path has no device proof and no shell app has `identity.ts`
- [ ] 0826 plugin-store does not fsync, so power loss can lose a save
- [ ] 1088 CI's `shell-ios` failed twice at action 3 of the outbox session drive
- [ ] 1060 a tap on the `Done: Bread` label makes no `change` on the iOS Simulator

### Lane 33 found-by-household · schema, testing · no RFC unless k.testing must name the value · S
- [ ] 1106 a generated `s.id` has no shape a server mints; `properties` breaks on it
- [ ] 1107 `find().text` of an input is always empty
- [ ] 1109 `renderRoute` with `app` records any string as a document, never E1501
- [ ] 1110 a statechart guard's payload is typed as every event's fields (RFC)
- [ ] 1111 `keel check` runs out of heap at 100,000 host elements

### Owned by a P1 workstream or in flight
- [ ] 0034 the freeze review and status flips (W1)
- [ ] 0413 `docs/freeze-review.md` "Tested, not stated" list unchecked against the suites (W1)
- [ ] 0605 `styles` reserved on every component (W1); decided: keep it reserved, give E1823 the k.aria file scope and `unsafe/` exemption, the fix renames the prop
- [ ] 0836 golden-3 has never been built (W1 step 4, the audit target)
- [ ] 0963 the active task to the start of P1
- [x] 1102 the 2026-11-24 mutation pass stopped unfinished
- [ ] 0953 a build-time check that a server bundle reaches no CLI-time package · in flight (RFC 0163)
- [ ] 0998 k.host-element names k.library before that section exists · in flight (RFC 0163)

## A2 Before public, after A1

### Lane 18 mutation-tooling · tooling · RFC only for 0403's loop bounds · L
- [ ] 0403 212 mutation timeouts sit in rule files with no loop
- [ ] 0404 five `@keel/check` mutants flip between killed and survived by load
- [ ] 0405 a scoped ui run printed a score under threshold; run it whole
- [ ] 0443 tests excluded from mutation only, for want of repo paths in the sandbox
- [ ] 0530 two stale-lock takeovers of `keel-mutate.lock` can both win
- [ ] 0542 `holderAlive` accepts any pid naming "mutate"; the stall clock counts dry runs
- [ ] 0626 `@keel/check` needs its own mutation budget; move exclusions to `ROOT_SANDBOX`
- [ ] 0713 the scrub's mutants run at 2 to 5 a minute
- [ ] 0761 `mutate:stale` and `pnpm ledger` disagree on what is stale
- [ ] 0924 files with no ledger claim are never mutated by the stale planner

### Lane 19 mutation-evidence (W3) · every package's tests, tooling · no RFC · L
- [ ] 0749 the evidence ramp: every survivor killed or justified, rungs raised (W3)
- [ ] 0914 tests to kill survivors in std-health, std-geo, std-i18n, std-brands, std-text
- [ ] 0967 961 server mutants survive; write the tests that kill them
- [ ] 0919 mutation for `apps/*`: the ledger reads `packages/` only and no app has a config
- [ ] 0920 module-top-level literals survive under Stryker's runner; count or exclude by rule
- [ ] 0922 five server `keel build` tests excluded from mutation may now run
- [ ] 0718 measure one `pnpm mutate:stale` run and the load beside it (runs need no ask)
- [ ] 0532 28 exports at `none` in the ledger; name each in a test or narrow the kinds
- [ ] 0816 the std-sessions `to-test` case hits its bound under `pnpm coverage`

### Lane 20 tooling-rough-edges · tooling, cli · no RFC · M
- [ ] 0291 Node's declarations add 0.3 s to each fresh type pass program
- [ ] 0814 `format-check` reads git-ignored build output
- [ ] 0767 the inspector smoke has not run since `--port 4180`
- [ ] 0878 docs-freshness (D0001) trips several docs at once; give the re-verify a cadence
- [ ] 0923 `devStubs.test.ts` resolves `@keel/router/internal` only through `NODE_PATH`
- [ ] 1076 the smokes CI does not run keep no crash output
- [ ] 1065 `shell-drive.mjs --shell tauri` times out on a locked screen instead of saying so
- [ ] 1044 `tasks/p1/review-findings.md` is undecided; decided: the lead decides each finding, a `keel-review.json` only if one needs it

### Lane 21 budgets · tooling, check · no RFC · M
- [ ] 0993 the one size review before P1: trim the cheap, set every budget to measured plus headroom
- [ ] 0335 no budget measures an app's client entry; add golden-2's
- [ ] 0845 `@keel/check` grew to its budget; a consolidation pass over the rules
- [ ] 1113 the held walk re-walks the import graph; share one graph

### Lane 22 check-rules · check, std-i18n, std-text, std-tokens · RFC where a rule's spec line changes · M
- [ ] 0315 E1509 treats every file as one route table; group by deployable
- [ ] 0325 E2301 and E1106 resolve by identifier only, not through `globalRefs`
- [ ] 0344 E1559 is reported by `keel build` only, not by `keel check`
- [ ] 0428 E1561 refuses a declared error shape narrower than any error
- [ ] 0857 E1406 has not run over `packages/` and `evals/` with types
- [ ] 0873 E2406 runs only for modules that list std-messages
- [ ] 0905 `keel check` reports E1010 for code files only
- [ ] 0804 the visible-character regex lives in three places that disagree on a lone surrogate
- [ ] 0676 a missing std dependency is E1005 only, and `credentials(ctx)` capabilities are unstated

### Lane 23 compiler-small · compiler, cli, std-messages, std-workflows · no RFC · M
- [ ] 0447 E1405 misses a `let`, nested reads, derived locals and called functions
- [ ] 0782 `RESUME_ENTRY.ts` is unused and a second way to build the resume entry
- [ ] 0910 a vitest `vmThreads` or `vmForks` pool would get stubs
- [ ] 1000 `routes.json` writes `guard: null` for no guard and for a guard without `redirect`
- [ ] 0935 three copies of `entryOf`; share one

### Lane 24 cli-records · cli, check · RFC (k.cli, 0508) · M
- [ ] 0508 an MCP `build` returns diagnostics as stderr text; decided: the result carries records
- [ ] 0879 `keel build` prints E1007 on stderr only, not as a record
- [ ] 0901 a build stopped by check ends with a `check` trailer; warnings dropped on success
- [ ] 1104 E1007's build line runs past 100 units unclipped
- [ ] 1097 `keel test` forces a `forks` pool silently; decided: a warning diagnostic

### Lane 25 scaffold-codemod · scaffold · no RFC · M
- [ ] 0308 the app template starts with the locale path param (decided D7)
- [ ] 0430 `keel codemod move` aborts on an interim cycle; a batch move
- [ ] 0959 the Tauri single-instance callback does not focus the window

### Lane 26 testing-ctx-store · testing, ctx, store, std-geo, tooling (S0009) · RFC (k.testing 0673, `@keel/testing` entries 0960) · M
- [ ] 0673 no way to carry a signed-in caller's cookie into a test; decided: one `@keel/testing` shape by RFC
- [ ] 0675 `renderRoute` has no log option
- [ ] 0844 `resumeDocument` mounts no router, so link-driven controls cannot be followed
- [ ] 0765 the sim net keeps a kill function per open body until it ends
- [ ] 1094 `simulate` runs a full collection when a pending set is read twice
- [ ] 0929 the std-geo sim gives one position and never `geo.unavailable`
- [ ] 0960 S0009 does not walk past `@keel/testing` because of a dynamic `vitest` import
- [ ] 0436 unavailable storage is an uncoded `Error`; give it a code
- [ ] 0805 the default `keyLimit` makes snapshots up to four times larger; measure it

### Lane 27 std-fixes · std-sessions, std-messages, std-headless, std-tables, std-workflows, std-tokens · RFC (std.tokens 0984) · M
- [ ] 0302 E2005 misses `createRequire`, `module.require`, aliased `require`, non-literal `import()`
- [ ] 0331 `formatMessage` renders `NaN`, `''` and `-0` with no dev diag
- [ ] 0506 `replayGroup` has no worker cap and no call timeout, so a hang leaks workers
- [ ] 0513 std-sessions depends on `vite` and `vitest` at runtime; decided: optional peers for `./group`
- [ ] 0600 a table link during a search load re-applies the old `q` and drops typed text
- [ ] 0619 E2351 and E2501 apply to test files, so a test cannot declare a twin
- [ ] 0859 std-headless typeahead uses `toLocaleLowerCase`, which E1758 reports
- [ ] 0984 std-tokens `check` takes a synchronous `find`, so tokens cannot live in a database

### Lane 28 std-db · std-db, CI · no RFC · M
- [ ] 0611 SQLite `BEGIN IMMEDIATE` with a 5 s busy timeout can block the event loop
- [ ] 0812 `sslmode=require` reads as full verification; decided: keep it, state it in std.db
- [ ] 0813 every connect failure is the same E2153
- [ ] 0828 a pool wait past the connect timeout is unexercised and unstated

### Lane 29 server-identity-deploy · server, compiler, std-sessions · RFC (k.user 0875, k.security 0867) · M
- [ ] 0875 no helper answers a redirect that carries an auth library's cookies
- [ ] 0876 `identify` cannot open a Keel store
- [ ] 0867 how a recorded session learns the caller lifetime is not specified
- [ ] 1030 every peer needs `KEEL_PEER_<NAME>` for peers it never calls; decided: only for called peers
- [ ] 0538 the tally merge can lose counts across processes; decided: state single-writer in std.monitor, CAS stays in FUTURE

### Lane 30 shells-native · cli, std-capacitor, std-tauri, CI · RFC 0198 for 1063 · L
- [ ] 0634 Tauri on Windows lacks `icon.ico`, and `--release` makes no installer
- [ ] 0766 `cargo` and `cap` keep the shell's `NODE_ENV`; decided: native steps follow production
- [ ] 0818 every `keel build` deletes Cargo's target, so a rebuild takes 60 s
- [ ] 0825 the shell replay runs one user's half of the race script
- [ ] 0827 no Android emulator replay of a recorded session
- [ ] 0866 an auth cookie surviving relaunch is unchecked on Android, iOS and Tauri
- [ ] 1062 no smoke runs an Android shell on an emulator
- [ ] 1063 `@capacitor/browser` ships without `identity.ts`; decided: RFC 0198's direction, the lead accepts it
- [ ] 1072 CI builds no native shell of the two native examples

### Lane 31 ui-and-brand · ui, apps/golden-1, apps/golden-2 · RFC (k.ui 0872, k.ui and k.security 0985) · M
- [ ] 0872 `Button` has no `name` or `value`, so a native post cannot tell buttons apart
- [ ] 0985 no `Video` or `Audio` element and no `media-src`; build after W15, captions required
- [ ] 1042 a brand pass on golden-1 and golden-2 from screenshots
- [ ] 1049 no button hover, disabled or checkbox style; decided: from BRAND.md's palette, stated in k.ui Base
- [ ] 0396 golden-1 left: filter links' current state, Undo's reason, `/digest` count labels
- [ ] 0838 golden-1 lists four std packages it does not import; decided: drop what no build reads

### Lane 32 evals-and-walkthrough · evals, apps/household, skills · no RFC · M
- [ ] 0429 eval `golden-1` expects files the app no longer has; update it
- [ ] 0577 `golden-2-catalog` lacks the two package twins of its gate
- [ ] 0987 the head-to-head Keel arm needs a kit of packed tarballs (W16)
- [ ] 1035 walkthrough findings L7-5 and L7-7 to L7-9 are open
- [ ] 1095 three household scenarios pass `law: false`; give each run its own server
- [ ] 1074 `list_writes` keeps every write key; decided: retention by age on a workflow
- [ ] 1108 nine things the skills did not tell an agent testing household

### Owned by a P1 workstream
- [ ] 0220 SVG system diagrams (W6 step 1)
- [ ] 0221 the human guided tour (W6 step 2); its newcomer review is O9
- [ ] 0222 agent documentation and the `public-docs` eval (W5 step 4)
- [ ] 0223 the launch checklist script (W12 step 6)
- [ ] 0355 a guide to building a Keel app by hand (W6 step 3)
- [ ] 0839 no getting-started guide; the walkthrough app answers it (W7)

## B Docs sweep

Closes with the sweep (W12 step 4).

- [ ] 0229 the sweep and reset for 1.0 itself
- [ ] 0497 RFC ids in older code comments
- [ ] 0598 RFC and backlog ids in package READMEs and `docs/guide/**`
- [ ] 0745 an RFC tag on line 1 of a conformance file (`rfc:` commit)
- [ ] 0983 `spec/std/README.md` holds history
- [ ] 0275 invalid search values fall back to defaults; decided: state the default in k.router, 422 stays in FUTURE
- [ ] 0289 state the Boundary reset behaviour for an outside computed
- [ ] 0313 state that `routes.ts` is evaluated on Node with no DOM
- [ ] 0341 add the route error answer and E1006 for an endpoints file to k.compat
- [ ] 0348 state the runner rejection code and the `KEEL_ORIGIN` and peer requirements
- [ ] 0416 a derived file count in `docs/guide/build-golden-1.md`
- [ ] 0425 the unrun nginx example and "7 artifacts" in `docs/guide/deploy-client.md`
- [ ] 0481 std.offline writes an option `s.number` does not take
- [ ] 0484 state the same-`at` replay order limit in std.multi
- [ ] 0529 keel-testing: a fresh `createApp` per `simulate` run
- [ ] 0574 `HarnessArtifacts` says `keel test` passes it; correct the doc
- [ ] 0655 k.server's `action` bullet omits `bearer`
- [ ] 0678 the stale golden-2 forms example; decided: Biome's import order wins, the lint note follows
- [ ] 0881 principle 2 against build-time stubs of server-only files
- [ ] 0904 k.bundle's environment exception omits three `KEEL_` names
- [ ] 0909 state that dev serves the identity `handle.path` and server-only stubs
- [ ] 0931 state that E2101 runs project-wide once one module lists std-brands
- [ ] 0982 the golden-2 README contradicts k.boundary on loader imports
- [ ] 1046 k.hosting's client artifact list leaves out `csp.txt`

## C After public

Moved to `tasks/FUTURE.md` with a reason; none is a missing piece of a 1.0 feature.

- [x] 0293 vitest 5: no advisory on 4.x; bump when 4.x stops getting fixes
- [x] 0603 E1111 reading `x-keel-pii` from `routes.json`: a refactor of a rule that works
- [x] 0604 label props taking a signal directly: a new API shape, getters work
- [x] 0621 a public replay function: a new API; the restart smoke checks the log
- [x] 0627 the E1112 false positive on a `s.secret` field: waits on the types-mode line
- [x] 0640 `$hmac-sha256$` digests: a new digest kind once an app key path exists
- [x] 0930 a timings reader in a build: the dev reader is the 1.0 feature

## D Closed now

Each verified in the tree; checked in the backlog with its reason.

- [x] 0230 S2 to S8 ran as lanes; S6 waits on W4 (0312); P1 lanes live in its plan
- [x] 0281 `resumeBoundary.test.ts` covers the nested Boundary; production shows `keel.unexpected`
- [x] 0294 pnpm 11 is pinned and the overrides sit in `pnpm-workspace.yaml`
- [x] 0304 `headHtml.ts` links each CSS file of the client build's entry chunk
- [x] 0316 route `title` takes `TitleProps` typed from params, search and loader
- [x] 0334 the prefix property has a param second segment; no length-only assertion
- [x] 0337 S7 is CLOSED in `tasks/STAGES.md`
- [x] 0339 the client takes a GET's `results[id]` (`routeResult.ts`)
- [x] 0342 overtaken by 0993: an overrun is re-based and recorded
- [x] 0346 `dev-port-0091` starts `keel dev`; k.topology is conformance-covered
- [x] 0349 k.topology is `conformance-covered`
- [x] 0368 a missing base surface is W1568
- [x] 0371 `accepts`, `pathCollisions`, `callsOf` fixed; `routeFor` is gone
- [x] 0372 the server entry falls back to the package's `./routes` (`stdRoutes`)
- [x] 0380 contracts replace endpoint files; no `*.service.ts` remains
- [x] 0381 golden-1 has no `Form({...})` call left
- [x] 0383 the duplicated reply schemas are gone; a contract declares each output once
- [x] 0388 k.services states the opaque redirect as `status` 0
- [x] 0418 overtaken by 0993
- [x] 0423 `hosting-peer-binding.test.ts` covers the binding
- [x] 0427 overtaken by 0993
- [x] 0434 E1156 reports any `ctx` capability outside `capabilities`
- [x] 0475 `landmark-unique` is the axe-core rule
- [x] 0483 the std-sessions tests no longer use E1720
- [x] 0486 route literals and hashes read `projectManifests`, stdlib routes included
- [x] 0496 RFC 0115 is implemented; `realNet` listeners end on `signal`
- [x] 0507 std-live bounds a read (RFC 0114)
- [x] 0510 RFC 0112 is implemented
- [x] 0524 overtaken by 0749: every survivor killed or justified
- [x] 0525 std.monitor states that placing `sessions` serves the tally
- [x] 0527 RFC 0112 is implemented
- [x] 0531 the k.ledger half is done; the k.testing half is 0317
- [x] 0570 duplicate of 1040, which asks the compact reporter to name each failure
- [x] 0576 duplicate of 0335
- [x] 0579 `biome.json` ignores `apps/*/reports/**`
- [x] 0609 CI's four shell jobs build natively; `shell-entry.test.ts` runs; the crash half is 0826
- [x] 0625 overtaken by 0749
- [x] 0629 overtaken by 0749, which clears every stale claim
- [x] 0688 a sign-up with a known email answers as a success
- [x] 0689 `api-routes-0086` asserts no 303; the tokens test runs real sessions
- [x] 0690 duplicate of 0974
- [x] 0721 overtaken by 0993
- [x] 0730 an RFC's text is not edited; the RFC set is rewritten at the reset (0229)
- [x] 0779 `TimeZone.ts` builds no `Intl.DateTimeFormat`
- [x] 0808 `COVERAGE.md` is generated and checked in CI; `STAGES.md` is kept by its own rule
- [x] 0821 mutation runs nightly (`mutate-nightly.yml`); the PR job stays label-gated
- [x] 0906 CI runs again: b4812607 is green on every job
- [x] 0936 `readProject.ts` skips `dist`; the endpoints file is gone
- [x] 0964 duplicate of 1060, which carries the repro plan
- [x] 0965 `shell-drive.mjs` ran on GitHub runners (the runs in 1088)
- [x] 1020 RFC 0182 is implemented with W1012 and its conformance
- [x] 1031 k.ui states both fixes with conformance bullets (RFC 0188)

## H Needs a human

- [ ] 0312 S6 exit: the external a11y audit and pen test need the two firms (O10)
- [ ] 0824 a physical Android and iOS device run and a Windows machine for Tauri

## Cleared

Lines of the earlier W2 lists that are checked in the backlog.

- [x] 0261 red-team: a spread copies an `s.secret` payload into open-object state, so live state holds a secret that `snapshot()` drops
- [x] 0270 red-team: the ledger counts a range clause covered when any one file cites it
- [x] 0274 W1557 (`secure` not set) fires behind a proxy and the sessions app has no switch for `secure: true`
- [x] 0287 `untrack` and `scope.run` reads of a thrown computed, and effects disposed while queued, are untested
- [x] 0292 `keel check` reports 7 errors in apps/sessions and no app's `check` script runs the checker
- [x] 0328 `line` and `para` accept text that shows as nothing or reorders; build RFC 0116
- [x] 0330 a guard redirect carries params by name only; check the carried fields' schemas in E1508's static half
- [x] 0332 the URL's `recipeId` renders as the not-found page's `h1`, so any sentence shows in the app's voice
- [x] 0350 an outside request carrying `x-keel-forwarded` gets 404 instead of a forward; a loop guard only, or signed from `KEEL_SECRET`
- [x] 0353 one `KEEL_SECRET` signs callers for every deployable; state it in k.topology and THREAT-MODEL
- [x] 0364 the per-deployable cap on concurrent event streams is unconfirmed (low, suspected); settle with 0503
- [x] 0366 `golden-1-api` acceptance hardcodes topologies and its hop count is a tautology
- [x] 0386 a `.server.ts` loader in a `client` deployable runs in the browser; golden-1's smaller hand-build items with it
- [x] 0402 the `pnpm.overrides` pins (`minimatch`, `qs`) are ignored by this pnpm; move them, pin `packageManager`, rerun `pnpm audit`
- [x] 0415 a GET to an API route with no loader answers 405 before its guards run, with no body
- [x] 0424 the client entry embeds the deployable-to-module map, so server module names reach the browser
- [x] 0441 an input that becomes `type="password"` only in the browser keeps its value in `#k-state`
- [x] 0463 the E1805 fix writes `<Box as="aside">` with no label, which is E1802
- [x] 0469 values a user sees as blank pass `required`, and JSON Schema `\S` disagrees with Python; decide the blank set in k.schema
- [x] 0478 every cookieless caller shares one `perCaller` allowance; build RFC 0121
- [x] 0501 a stored outbox entry posts to its stored `origin` unchecked and to the next signed-in user's caller; build RFC 0120
- [x] 0503 one stream pool for every live loader lets one client starve every channel subscriber; THREAT-MODEL and std.channels say nothing caps streams
- [x] 0509 the outbox sends through `service({ module })`, `send` takes no origin and entries carry none (RFC 0120, with 0501)
- [x] 0517 `surfaceRun` drops a `routes.ts` that throws, so `keel build` exits 0 and E1562 can pass a break (needs a design)
- [x] 0519 E1567 misses a namespace import of `@keel/services` (budget at 18 B over)
- [x] 0521 `stdRoutes.ts` reads a stdlib manifest by path, so a published std package serves no routes
- [x] 0569 client `.map` files a Vite config turns on are served from `assets/`
- [x] 0572 the 1.3.2 and 2.4.3 claims map only to E1820 and are always `none`; earn or drop them
- [x] 0595 a marked open object's undeclared keys have no `piiPaths` entry though `piiValues` returns them
- [x] 0608 Capacitor's net driver sends a URL on another origin while Tauri's scope refuses it; one rule for k.shell
- [x] 0616 no tools rule reports a revealed value passed to `enqueue` (needs E1112's value walk exported)
- [x] 0617 no warning when a password control binds a field that is not `s.secret`
- [x] 0638 E2203, a `Digested` node in a loader `output`, waits on the checker exporting its schema reader
- [x] 0656 k.privacy's `[pii]` sentence for a later throw names a path no request reaches; reword it
- [x] 0671 another package replacing or clearing the `onSecret` slot leaves a running app unscrubbed
- [x] 0674 neither k.guards nor k.api says whether a bearer check denies in a guard or a loader
- [x] 0683 copies of a secret in other encodings (`+`, `encodeURI`, double encoding, JSON `
- [x] 0692 k.shell clause 6's test matches the word `drivers`, which any bundle holds
- [x] 0693 k.hosting clause 2's fetch URL, `credentials: 'include'` and unset case are observed by no test
- [x] 0722 the dev body of a component that throws while rendering is clipped and not scrubbed
- [x] 0733 E1111 reads a schema object changed after its literal as clean
- [x] 0737 red-team: some 404 path shapes (`;jsessionid`, `%20`, homoglyphs, `&code=`) are written raw
- [x] 0747 `resume` with `mode: "dev"` has no conformance case
- [x] 0775 red-team: a `vite.config.ts` that sets `NODE_ENV` gives app code `DEV === true` under `keel build`
- [x] 0777 red-team: the bounds read the opener module's config but count every module's sinks
- [x] 0783 the std.channels sentence on a member refusing `""` has no test of its own
- [x] 0785 state the decided limit: app code holding the ctx can `dispose()` its online and offline events
- [x] 0787 THREAT-MODEL (stored logs) does not mention the store's `keyLimit`
- [x] 0796 red-team: E1802 passes a label of C0 and C1 controls
- [x] 0797 red-team: the flush's retry timer outlives `drain`'s scope and still posts
- [x] 0798 red-team: an `events: true` endpoint in an outbox leaves its entry `sending` across reloads
- [x] 0799 red-team: two ctxs over one module-level outbox fail each other's entries
- [x] 0801 red-team: the `s.json()` check overflows the stack on about 200k nesting from a JSON body
- [x] 0802 red-team: a large `keyLimit` costs O(keyLimit) per keyed write; `restore` parses a forged `keys` array whole
- [x] 0829 the three TLS cases skip in CI; start Postgres with a certificate in a step
- [x] 0831 E1303 misses `reveal` in helpers, re-exported reducers and `export { reveal as open }`
- [x] 0856 k.security says E1571 decides by E1004's reachability; the rule decides by filename only
- [x] 0865 no built `server.mjs` with an `identity.server.ts` has run; add it to the built smokes
- [x] 0874 `Text` has no `role`
- [x] 0877 `pnpm evidence:report` writes data from a dirty tree without refusing
- [x] 0883 `keel scaffold service` in a client-only module writes a file that fails E1571
- [x] 0892 red-team: no gate catches a committed ledger or evidence file that differs from what the tree produces
- [x] 0893 red-team: E1579 misses a param route matching `handle.path`, and the client router swallows mount links
- [x] 0894 red-team: `identityMount` does not validate `path` at runtime, so `/vil.example` resolves off-origin
- [x] 0903 `identify` returns the bearer answer whenever an `authorization` header is present and never reads the session cookie
- [x] 0911 `POST /api/recipes` writes without a signed-in user while `/recipes/new` is guarded
- [x] 0916 the mutation cache reuses a result after tests are added; key it on the test files
- [x] 0918 a rule that throws becomes E1756, which tests filtering for one code never see
- [x] 0926 a placed stdlib module that resolves no routes is silent; report it (RFC for the diagnostic)
- [x] 0932 no app-level live region, so a result line after an action is not announced
- [x] 0941 W12 step 1: the licence (operator, O4)
- [x] 0942 CI workflows declare no `permissions:`, pin actions by tag and hand `TURBO_TOKEN` to every step
- [x] 0943 40 packages are publishable; mark them private until launch
- [x] 0944 `.gitignore` gaps, no `SECURITY.md` or `CONTRIBUTING.md`, THREAT-MODEL out of date on streams
- [x] 0945 confirm with a test that the 0501 and 0478 fixes are built, then close both
- [x] 0946 strip home paths and quotations of the operator before the public repository; a check that fails on either
- [x] 0948 k.shell's CI paragraph and ROADMAP on iOS and macOS Tauri jobs
- [x] 0954 k.cli Inspect says nothing of one origin serving two deployables' sections; golden-2's page timings are hidden (RFC)
- [x] 0956 any page can open a shell return link with native cookies; RFC 0147 build
- [x] 0957 a Capacitor app with `identity.ts` missing `@capacitor/app` or `@capacitor/browser` is not reported (extend E1572)
- [x] 0966 std-sessions mutation is unmeasurable for want of a mutation vitest config
