# RFC 0145: every std package's runtime entries reach no CLI-time package

Status: draft, for the orchestrator to accept (ADR-0167).

## Problem
A deployable that imports a std entry carries that entry's whole import graph into `server.mjs`, and into a browser bundle when a page imports it. An entry that reaches `@keel/cli` or `@keel/check` pulls vite, vitest, typescript and oxc-parser behind it, and `keel build` fails on packages those tools resolve lazily (`Could not resolve "@vitejs/devtools/config"`). RFC 0144 fixed this for `@keel/std-report` alone and left the rule unstated.

k.module **Std config** says `keel check` and `keel build` import a std package and its `./tools` export. It does not say what may sit on which entry, and nothing checks it.

### Audit
Every key of `exports` in each of the 25 `packages/std-*` packages (62 entries) was bundled alone with esbuild (`bundle: true`, `platform: 'node'`, `format: 'esm'`, only Node built-ins external; `vite`, `vitest`, `typescript`, `oxc-*` recorded at the import and not followed), and the metafile's import edges were walked from the entry, dynamic imports included. A type-only import is erased and does not count.

Offenders (an entry other than `./tools*` and `./module` that reaches a CLI-time package):

| package | entry | reaches | first step of the chain |
| --- | --- | --- | --- |
| `@keel/std-conflicts` | `.` | `@keel/cli` (then vitest, typescript, oxc-parser) | `src/index.ts` > `src/RaceRecord.ts` > `@keel/cli` (`formatter`) |
| `@keel/std-conflicts` | `.` | `@keel/check` (then typescript, oxc-parser) | `src/index.ts` > `src/raceFound.ts` > `@keel/check` (`defineRule`); the same through `src/raceUnchecked.ts` |
| `@keel/std-brands` | `.` | `@keel/check` (then typescript) | `src/index.ts` > `src/idBrandCase.ts` > `@keel/check` (`defineRule`) |
| `@keel/std-brands` | `.` | `oxc-parser` | `src/index.ts` > `src/idBrandCase.ts` > `src/internal/brandLiterals.ts` > `oxc-parser` |
| `@keel/std-sessions` | `./action` | `@keel/cli` (then vitest, typescript, oxc-parser) | `src/action/index.ts` > `src/runAction.ts` > `src/SessionRecord.ts` > `@keel/cli` (`formatter`) |

Not offenders:
- `@keel/std-sessions` `.` is clean. It reaches `@keel/compiler/inspect/inspector`, `@keel/ctx`, `@keel/reactive`, `@keel/schema` and `@keel/store`. Its rule files (`adapterNotNode.ts`, `monitorNotNode.ts`, `groupRules.ts`, `redactPath.ts`) are imported by `src/tools.ts` only. `./routes`, `./monitor`, `./record`, `./session`, `./Session`, `./redact` and `./group` are clean.
- `@keel/std-report` `.` reaches `@keel/schema` alone.
- The other 20 packages' main entries, and `./server` (std-channels, std-tokens), `./routes` (std-health), `./sqlite` and `./postgres` (std-db) are clean.
- Runtime subpaths of the compiler are reached by clean entries and reach no tool: `@keel/compiler/std/stdConfig` (std-jobs, std-channels `./server`, std-sessions `./routes`), `@keel/compiler/inspect/inspector` (std-timings, std-sessions, std-workflows), `@keel/compiler/std/bindStd` (std-sessions `./replay`).

CLI-time by design, and exempt:
- `./tools` (12 packages) and `./tools/internal` (std-jobs, std-statecharts).
- `./module` (std-channels, std-health, std-jobs, std-schedules, std-sessions, std-workflows): a manifest imports `module` from the root of `@keel/compiler`, which reaches `oxc-parser`. An app's own `module.ts` does the same, and no deployable bundles a manifest.

Seen and left alone: `@keel/std-sessions` `./replay`, `./minimize` and `./commandJob` reach `@keel/testing` (fast-check, axe-core). std.sessions states that on purpose ("the root imports no `@keel/testing`"), and `@keel/testing` is not a CLI-time package under this rule.

## Proposal

### D1. The rule, stated once in k.module
> Only a stdlib package's `./tools*` and `./module` entries may reach `@keel/cli`, `@keel/check`, `vite`, `vitest`, `typescript` or `oxc-*`; rules, formatters and commands register in `./tools`.

"Reach" is by any import the bundler follows, static or dynamic. `@keel/compiler` is not in the list: its root entry reaches `oxc-parser` and is caught by that name, and its `std/*` and `inspect/*` subpaths are runtime code that five std packages need.

### D2. Enforced by a structure lint, S0009
`tooling/structure-lint.mjs` gains S0009, run by `pnpm check`. For each `packages/std-*` package and each key of its `exports` other than `./tools`, a key under `./tools/`, `./module` and `./package.json` (a `./*` pattern expands to its files): bundle the entry as the audit did and report the first edge into `packages/cli/`, `packages/check/`, or a bare `vite`, `vitest`, `typescript` or `oxc-*` specifier.

```
S0009 packages/std-conflicts/src/RaceRecord.ts:1:1 entry @keel/std-conflicts reaches @keel/cli: src/index.ts > src/RaceRecord.ts; register in ./tools
```

It is red today on the three offenders and green after D3 to D5. No code is reserved in the E ranges, and no kernel package changes. A third-party std-style package is told by the k.module sentence and protected in browser builds by E1007 (a tool package imports Node built-ins); its server build has no gate (Alternatives, A1).

### D3. `@keel/std-conflicts`
- Main entry: unchanged exports, `RaceRecord`, `findRaces`, `raceRecords`, `races` and the seven types. `src/RaceRecord.ts` keeps the schema and loses the `@keel/cli` import and the `formatter` call. `src/index.ts` loses `import './raceFound.ts'` and `import './raceUnchecked.ts'`.
- New `./tools` (`src/tools/index.ts`, no exports): `formatter('conflicts.race', { schema: RaceRecord, compact, pretty })` and the two `defineRule` files.
- Verified by bundling the main entry with those three edges cut: it reaches `@keel/ctx`, `@keel/reactive`, `@keel/schema`, `@keel/store` and `@keel/std-sessions` only.

### D4. `@keel/std-brands`
The package has one export, `idBrandCase`, a check rule. It is CLI-time only, so it moves: `@keel/std-brands/tools` exports `idBrandCase` and registers it, and the main entry exports nothing and imports nothing. A module still lists `@keel/std-brands` in `deps`, and `keel check` loads `./tools` (k.module).

### D5. `@keel/std-sessions`
No export moves. The `formatter('session', ...)` call leaves `src/SessionRecord.ts` for a file `src/tools.ts` imports, so `./action` stops reaching `@keel/cli`; `runAction` uses the schema and `sessionCompact` directly and never needed the registration. std.sessions does not change.

### Moved exports and registrations
| what | from | to | imported from the old place by |
| --- | --- | --- | --- |
| `idBrandCase` (export and registration of E2101) | `@keel/std-brands` | `@keel/std-brands/tools` | `packages/std-brands/conformance/brands.test.ts:16`; no app file (golden-2's three manifests list the package in `deps`, and `apps/golden-2/test/brands.test.ts` runs the binary) |
| registration of `conflicts.race` | `@keel/std-conflicts` (import side effect) | `@keel/std-conflicts/tools` | `packages/std-conflicts/conformance/formatter.test.ts` (`respond`, and its E1053 test); `evals/tasks/golden-1-api/acceptance.test.ts:516` (`respond(raceRecords(...))`); `packages/std-conflicts/test/raceRecords.test.ts` if it renders |
| registration of E2701, W2702 | `@keel/std-conflicts` (import side effect) | `@keel/std-conflicts/tools` | no conformance or app file calls `rules()` or `explain` for them |
| registration of `session` | `SessionRecord.ts` (reached from `./tools` and `./action`) | a file of `./tools` | none: every reader imports `./tools` already |

No app file under `apps/` imports `@keel/std-conflicts` or `@keel/std-brands` as code. `apps/golden-1` has `@keel/std-conflicts` in its `package.json` and in no manifest's `deps`.

## Known limits
- S0009 reads this repository. A std-style package published elsewhere is bound by the k.module sentence and by nothing mechanical for its server build.
- The list of CLI-time packages is closed and short. A new tool dependency of `@keel/cli` or `@keel/check` is covered through those two; a tool a std package imports directly under another name is not.
- `@keel/testing` on `./replay`, `./minimize` and `./commandJob` of std-sessions stays (Audit).

## Alternatives
- A1. A build-time assertion with a new code: after bundling `server.mjs`, `keel build` fails with a reserved E100x when the graph holds `@keel/cli`, `@keel/check` or a tool, naming the chain, as E1007 does for server code in a browser build. It protects every app and every third-party package, and replaces a resolver error with a diagnostic. Not chosen now: no rule family walks the server bundle's graph today (E1007 is the browser Assertion), so it is new machinery in `@keel/compiler`; k.boundary (5,973 characters of 6,000) and k.deploy (5,984) have no room for the clause, and k.bundle, which has, is the browser section; and it reports the fault at an app's build, after the package shipped. Proposed as a backlog line; S0009 stays useful beside it because it fails before a package is published.
- A2. A conformance bullet per package (std.report's bundle bullet, repeated). Twenty-five copies of one rule, and a new package is unprotected until someone writes its bullet. Rejected.
- A3. One k.module conformance bullet that bundles every `packages/std-*` entry. It makes a kernel suite depend on the stdlib's layout and costs about 300 characters in a section with 4 to spare. Rejected for the lint.
- A4. Keep `idBrandCase` on the main entry of std-brands and exempt packages with no runtime export. An exemption list in the lint, and the rule stops being general. Rejected.
- A5. Exempt `./action` of std-sessions as CLI-time. A fourth exempt name for one package, when moving one `formatter` call makes the entry clean. Rejected.
- A6. List `@keel/compiler` as CLI-time. Its `std/*` and `inspect/*` subpaths are runtime, so clean entries of five packages would fail. Rejected; the root entry is caught through `oxc-parser`.

## Spec diff
- `spec/kernel/k.module.md` (5,991 to 5,996 characters): **Std config** gains the D1 sentence after "`check()` imports nothing.". To fit, prose that no conformance header quotes is shortened with no change of meaning: the example manifest lists one capability and two exports; "this module's" and "this module" become "its" and "it"; "Each key is a stdlib package in `deps`." goes (E1158 states it); "Everything not listed is private. ... ; there are no barrels." becomes "Anything not listed is private. ... : no barrels."; "`check()` itself imports nothing" loses "itself"; "(fail: throws E1158)" becomes "(fail: E1158)"; "Browsers get only client-readable config: packages marked" becomes "Browsers get only the config of packages marked"; "Other packages and modules read `{}` there." goes (the island bullet states it). Status unchanged: no bullet is added; S0009 carries the rule.
- `spec/std/std.conflicts.md` (4,033 to 5,175): status `implemented` until the conformance lands; **Extension points** names the check rule registry and the tools entry; new **Entries** paragraph; bullets 9 and 10 appended.
- `spec/std/std.brands.md` (2,341 to 2,794): status `implemented`; **Extension point** and **API** name `@keel/std-brands/tools`; new **Entries** paragraph; bullet 7 appended. Bullets 1 to 6 are unchanged. Bullet 1 says "After importing `@keel/std-brands`"; it holds for the package through its tools entry, which is how its test imports the rule, and not for the main entry alone (Choices, C5).
- `spec/std/README.md`: the std.conflicts and std.brands rows read `implemented`.
- `spec/00-map.md`: unchanged. `spec/std/std.sessions.md`: unchanged.
- Codes: none new in the E ranges. S0009 is a tooling code.

Appended std.conflicts bullets:
9. With only `@keel/std-conflicts` imported, `respond(raceRecords(...))` (`@keel/cli/testing`) yields E1054 and `rules()` lists neither E2701 nor W2702; after `import('@keel/std-conflicts/tools')` it prints the compact lines, `rules()` lists both and a second `formatter('conflicts.race', ...)` throws E1053.
10. `@keel/std-conflicts` exports exactly the values `RaceRecord`, `findRaces`, `raceRecords` and `races`, and `@keel/std-conflicts/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.

Appended std.brands bullet:
7. The main entry `@keel/std-brands` exports nothing and `@keel/std-brands/tools` exports exactly `idBrandCase`; the package's `exports` has the keys `.` and `./tools`.

## Conformance diff
One `rfc:0145` commit by the `conformance-writer`, red:
- `packages/std-conflicts/conformance/`: a new file for bullet 9 that does not import the tools entry at top (the formatter and rule registries are process-wide; vitest isolates files), and one for bullet 10. `formatter.test.ts` adds `import '@keel/std-conflicts/tools'`; its first test's title says the main entry registers the kind and is retitled to the tools entry. The other seven files are unchanged.
- `packages/std-brands/conformance/brands.test.ts`: the import becomes `import { idBrandCase } from '@keel/std-brands/tools'`; the six headers are unchanged. A new file for bullet 7.
- `packages/cli/conformance/module-std-deps-loaded.test.ts` (k.module, E2101 through `deps`): no clause change. Its fixture links `std-brands` and `schema` into `node_modules`; the tools entry imports `@keel/check` and `oxc-parser`, which resolve from the package's real path. The builder confirms it stays green.

## Migration
- `tooling/structure-lint.mjs`: S0009 (D2), with a test under `tooling/test` over a fixture package whose main entry reaches a file under `packages/cli/`.
- `@keel/std-conflicts`: D3; `exports` gains `./tools`; `@keel/cli` and `@keel/check` stay dependencies. README names both entries.
- `@keel/std-brands`: D4; `exports` gains `./tools`. README, `docs/ARCHITECTURE.md` and the skills that name `idBrandCase` name the tools entry.
- `@keel/std-sessions`: D5.
- `evals/tasks/golden-1-api/acceptance.test.ts` and its `spec-slice.txt`: `import '@keel/std-conflicts/tools'` beside the `respond` call. `packages/compiler/test/std-config.test.ts` and `packages/std-conflicts/test/*`: the same where a test renders or reads the registry.
- `tooling/budgets.json`: entries for the two new `./tools` exports; the main entries shrink.
- Changesets: `@keel/std-conflicts`, `@keel/std-brands`, `@keel/std-sessions`.
- Migration note for code outside the repo: `import { idBrandCase } from '@keel/std-brands'` becomes `from '@keel/std-brands/tools'`; code that renders `conflicts.race` records with `respond`, or reads E2701 or W2702 from the rule registry, adds `import '@keel/std-conflicts/tools'`. A project that lists either package in a module's `deps` needs no change for `keel check` and `keel build`.

## Build order
1. This RFC, ADR-0167, k.module, std.conflicts, std.brands and the README rows (commit 1).
2. `conformance-writer`: the Conformance diff, red (commit 2).
3. Builders: the Migration, one lane per package and one for the lint; std.conflicts and std.brands back to `conformance-covered` when green.

## Token impact
k.module 1,499 (was 1,498). std.conflicts 1,294 (was 1,009). std.brands 699 (was 586). Map unchanged.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the CLI-time list is `@keel/cli`, `@keel/check`, `vite`, `vitest`, `typescript`, `oxc-*`; `@keel/compiler`'s root is caught through `oxc-parser` (D1, A6). Runner-up: add `@keel/scaffold` and `@keel/testing`; the second fails three std-sessions entries that reach it on purpose.
- C2: the exempt entries are `./tools`, keys under it and `./module` (D2).
- C3: the gate is the structure lint S0009; the build-time code is a backlog line (A1).
- C4: std-brands' main entry is empty and `idBrandCase` lives on `./tools` (D4). Runner-up: A4.
- C5: std.brands bullet 1 stays as written and is read of the package, loaded through `./tools`. No bullet says the main entry alone registers nothing: that sentence would contradict bullet 1 as written, and S0009 already makes it impossible (an entry that cannot reach `@keel/check` cannot register a rule). Runner-up: change the one specifier in bullet 1 to `@keel/std-brands/tools` and add the negative bullet; tried, and `keel ledger --diff` then fails with E1706 (`std.brands#1 example -> none`) until the build lands.
- C6: `./action` of std-sessions is made clean instead of exempt (D5, A5).
- C7: k.module keeps `conformance-covered`: it gains a sentence and no bullet, and the lint is its check. Runner-up: A3.
