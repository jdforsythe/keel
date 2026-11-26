# End-user review

Hands-on reviews from the packed kit, one per persona (`tasks/p1/personas.md`). Each row is a finding with its evidence and the smallest change that closes it. The workstream that closes them is W17 in `tasks/p1/TODO.md`.

## L1 Component library author (2026-11-25, main line 72167498)

Verdict: yes, with pain. From the kit alone an outsider scaffolds a library, writes three components (a badge, a toggle, a card with a slot), tests, packs and installs it into a scaffolded app, with check clean, no `unsafe/` and no rule off, in about 15 minutes. A real component library stops at the first four rows.

Verified by running:

| Sev | Finding | Evidence | Smallest change |
| --- | --- | --- | --- |
| blocker | A token name the app lacks passes the library's check, test and pack, and passes the app's check, then fails the app's `keel build` with an E1801 that names no file or line | `radius="full"` in the library, `bg="nope"` in the app | RFC 0241 puts E1801 in `keel check` for app code; extend it to a library's own folder (judged against its fixture `tokens.ts`) and to a listed library's `src/`; E1801 carries file and line at build |
| major | A library cannot ship a look of its own: it names tokens and hopes the app has them | keel-library skill, "Colour"; the run above | An RFC: a library declares the tokens it needs (checked against the app's at `keel check`) and may ship default values the app overrides |
| major | No `switch`, `slider` or `radio` role among `Part` roles | `keel docs k.aria` roles table | An RFC adding the roles a component library needs; list them from the ARIA authoring practices |
| major | `properties(Component)` fails with an opaque E1704 on a generated `id` of `"`; property tests through a probe do not raise a component's rung | the run; `libraries/charts/.keel/ledger.json` holds every chart at `example` | `@keel/testing` generates an id-shaped `id`; a probe's property credits the component it renders |
| major | No publish story: nothing on npm publishing or provenance | no doc mentions it | A Publish paragraph in k.library-pack and the keel-library skill; the library scaffold writes a CI workflow that packs, checks and publishes with provenance |
| major | `keel scaffold library` writes no agent files, skills or `.gitignore`; `keel scaffold project` does | `packages/scaffold/src/internal/opLibrary.ts` | The library scaffold writes the same agent files, with keel-library first |
| minor | E1751 cuts the TypeScript message short even with `--format=pretty` | the run: the cause was readable only from `tsc` | E1751 keeps the whole first message |
| minor | Slot typing (`children: () => Child`, required) and "a checkbox `Part` takes no children" are found only by reading `.d.ts` files | E1406, E1751 in the run | One card and one toggle example in keel-library |

Read from code, not run (to confirm before a fix):

| Sev | Finding | Where | Smallest change |
| --- | --- | --- | --- |
| major | A shipped ledger's rungs are taken on trust by the app; only `unsafe` and host elements are recounted | `packages/cli/src/internal/libraryLedgers.ts:45` | Ship the run report and verify rungs from it, or show a library's rungs as claimed |
| major | Stdlib rules (E2xxx) and formats may be off in a library's own folder | `packages/check/src/internal/stdInScope.ts:46` | `lane-std-formats` changes this (own `./tools`, the `module.ts` view); confirm after it merges |
| major | A library's `src/<id>.contract.ts` may not be read as a contract | `moduleContracts.ts:16`, `contractPlacement.ts:32` | RFC 0239 in `lane-std-formats` changes this; confirm after it merges |
| minor | Library tests skip E1576; no a11y report, evidence bundle or mutation runner in a library's own folder; a static a11y finding in a library file does not lower an app route's a11y claim | `noInternalEntry.ts:10`, `testCommand.ts:122`, `a11yFindings.ts:26`, `bundleWrite.ts:86` | An own-folder `reports/a11y.json` and `keel evidence`; `a11yFindings` reads a listed library's files; a documented mutation command for a library |

What worked: the scaffold is green on first run; `keel pack` holds the ledger to the code; contrast and axe checks run in the library folder; ids, casts, pii and secret rules reach a library's `src/`; peers and the `keel` source condition are right; an app's check reads library source with no build; most commands take about 2 s.

## A2 Product engineer, with a third-party library (2026-11-25, main line 72167498)

Verdict: yes, with pain. From the kit alone: a scaffolded app, a node page with a server loader and an action over a store, check and test green, `server.mjs` serving it, the charts library installed from its tarball and drawing in a browser. About 25 commands and 6 misreadings of the docs. Check sees a library's ordinary code as the app's own; two holes sit outside what it sees.

Verified by running:

| Sev | Finding | Evidence | Smallest change |
| --- | --- | --- | --- |
| blocker | No install path for an outsider: `pnpm add <kit>/keel-cli-0.0.0.tgz` fails because the tarball's dependencies are not on a registry; it works only with hand-written `overrides`; nothing exists for the later npm flow (`pnpm create`, `create-keel`) | `@keel/check is not in the npm registry` | A `create-keel` package (`pnpm create keel`), and a kit README with the `overrides` recipe until the packages are on npm |
| major | A library's `./tools` file runs any Node code during `keel check` and `keel build`; the app approves nothing | a `tools.js` wrote a file in `$TMPDIR` and read the environment | `./tools` is a capability the app grants (RFC 0240's `grants`); ungranted, it is not imported and check says so |
| major | A library's `unsafe/` code is a full escape the app's check never shows: a raw `fetch` posted to the app's own action on page load and planted a row | check 0 errors; `keel ledger` `1 unsafe` and `ok` | A library's `unsafe/` is a capability the app grants, with the count; the scaffolded CI runs `keel ledger --diff` |
| major | A library's server-render code can stop the server: a floating rejection logs E1577 and the process exits | one GET, then no process | `@keel/server` answers 500 and keeps running |
| major | The keel-testing skill says `fire(<submit>, {type:'submit'})` submits a `Form`; with `app`, no POST is sent; `click` works | `requests()` showed only the GET | Fix `fire` or the skill, with a test |
| major | `simulate` over `createApp` with a POST fails its replay check (E1729, "differ at trace entry 31", no detail); it passes only with `law: false` | `keel test` | Find the nondeterminism in `@keel/server` under sim; E1729 prints the two entries; a worked app example |
| major | No end-to-end test for an app developer: the repo's smokes are internal; Playwright was brought by hand | `tooling/smoke/*` | An RFC: `keel test --e2e` over the built app in a real browser, from `@keel/testing`; the repo's smokes move onto it |
| minor | The scaffold leaves module `app` in `topology.ts`; the skill's `createApp({ topology, routes, ctx })` then fails E1552 while check is clean | test run | Check reports it, or the skill shows the working call |
| minor | E1005 (`.keel/surface.json` stale) after every component edit until `keel build` | repeated | `keel check` refreshes it |
| minor | A form input's id is generated (`form-32rqfi:text`) unless the app gives one | `a11y()` dump | Ids derived from the field path |
| minor | `keel scaffold route notes.list` gives E1052 "at path (required)", which does not say `--path` is missing | the run | The message names the flag |
| minor | `keel review` fails on a fresh, clean app: R1053 and R1056 on Keel's own bundle, 50 R1101 on lockfile `file:` entries | `fail review 59 fail` | The kernel's bundle is not judged; `file:` entries from the kit are |
| minor | A library's API is not in `keel docs`; its README is only in `node_modules` | `keel docs` | `keel docs` lists installed libraries and prints their README and exports |
| minor | A no-server app still depends on and imports `@keel/server` for `topology`; the default title is `web` | the static scaffold | `topology` from a package with no server in its name; the title asked or derived |
| minor | `keel test` hides `console.log` | the run | A flag or a documented way to see it |
| human | Another product ships a global `keel` binary; it answered `pnpm exec keel` in a folder without `@keel/cli` | `keel --help` printed another tool's commands | The operator's: the bin name before npm |

Check does catch, in a library: a direct `fetch` (E1601), `ctx.net` to an undeclared origin (E1651, E1571), a missing capability (E1156), a ledger miscount (E1162).

What worked: one `pnpm add` and one `deps` line to add a library, with types; `renderRoute`, `render`, `focusOrder`, `properties`, `explore`, `prove`, sim `ctx.net.route`, negative type tests, the ledger's a11y rungs and `keel evidence`; diagnostics with fixes; a strict content security policy; forms that work without JavaScript; a static build with no server concept in the bundle; evidence signing. Not run: `keel dev`.
