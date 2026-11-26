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
