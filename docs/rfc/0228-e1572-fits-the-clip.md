# RFC 0228: k.shell: E1572's plugin message fits 89 units whole; a shell target's texts are bounded

Status: accepted (ADR-0250), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.shell (Plugins, Rules, Conformance), std.capacitor (Plugins, Conformance), the map. From the first whole test run of task 0963 (D145) and backlog 1061.

## For the operator
1. **`in package.json dependencies` leaves the plugin form only.** The storage and shell-package form (`api: sqlite needs @keel/std-db in package.json dependencies`, 59 units; 69 at most for `web`) keeps it: it fits, and no clause or test changes for it. The plugin form is told where to add the entry by its `fix` (a `package.json` hunk under `dependencies`, printed with the line) and by `keel explain E1572`.
2. **One bound on the three texts together, 50 characters, not one per field.** A plugin name, its version and its need trade length against each other; one sum gives the message a fixed ceiling, `<deployable>` plus 72 units with `capacitor`.
3. **`@capacitor/browser`'s need becomes `external browser sign-in`.** 24 characters, in place of `the external browser of identity.ts` (35).
4. **E1575 gets a stated template and the same kind of bound** (`tool` and `need` at most 60 together), as its texts are a shell target's free text too. Today's longest is 84 units; nothing changes in the build but a unit test.
5. **No length check on a target's entries.** A third-party target past the bound gets its message clipped by k.check's rule; no new diagnostic.
6. **Thrown errors and build lines stay out** (Sweep): E1708, E1715, E1716, E1727, E1728 and E1007 can pass 89 at real names, and are not `diag` records `respond` clips. Recommended: a backlog line for E1007's chain (front-shortened as E1011's importer); the thrown ones are k.errors' to decide.

## Problem
k.check Diagnostics (RFC 0222) clips every `diag` record's message at 89 UTF-16 code units, and says each message is written to fit its fixtures' inputs. k.shell Plugins fixes E1572's plugin form as `<deployable>: <shell> needs <plugin> <version> in package.json dependencies (<need>)`, with `need` up to 60 characters. The real values `@keel/std-capacitor` gives (`capacitorPlugins.ts`, its `package.json` pins):

| plugin | version | need | message for `web` |
|-|-|-|-|
| `@capacitor/preferences` (22) | `8.0.1` (5) | `storage` (7) | 88 |
| `@capacitor/app` (14) | `8.1.2` (5) | `launch and return links` (23) | 96 |
| `@capacitor/browser` (18) | `8.0.5` (5) | `the external browser of identity.ts` (35) | 112 |

Two of three are clipped, so `packages/std-capacitor/conformance/shell-plugins.test.ts` (lines 203, 212, 232, 242, through `line()` at 165) and `packages/cli/conformance/shell-plugins.test.ts` (55, 109, 136) fail against the whole text. `std-tauri`'s `plugins` is `[]`, so it gives none.

Why k.check#23 (`packages/check/conformance/diag-message-fit.test.ts`) did not catch it: it runs each code's one fixture in `fixtures-by-code.ts` through in-process `check()`. E1572's fixture is the storage form (`web: sqlite needs @keel/std-db in package.json dependencies`, 56 units). The plugin form is built only by the CLI's shell pass (`packages/cli/src/internal/shellTargets.ts`, through `dependencyNeed`), from a shell package's `./tools`, which `check()` never loads; and the 60-character `need` k.shell allowed passes 89 for any plugin name. The hole is a code with a second message form built outside `check()`, from text a package supplies. The same holds for E1575 (`shellPlan.ts`: `<tool> missing or too old: needs <need>`), which no spec text bounds.

## Proposal
### E1572's plugin form
`<deployable>: <shell> needs <plugin> <version> (<need>)`. `plugin`, `version` and `need` hold at most 50 characters together. The fixed text is `: ` (2), the longest shell, `capacitor` (9), ` needs ` (7), the space before the version (1), ` (` and `)` (3): 22. So the longest message is `<deployable>` + 72 units with `capacitor`, + 68 with `tauri`. It fits whole for a deployable name of up to 17 characters (21 with `tauri`); every deployable in the tree is `web` or `api`. A longer name is clipped by the rule, the safety net k.check describes.

The new messages, for `web`:
- `web: capacitor needs @capacitor/preferences 8.0.1 (storage)` (59)
- `web: capacitor needs @capacitor/app 8.1.2 (launch and return links)` (67)
- `web: capacitor needs @capacitor/browser 8.0.5 (external browser sign-in)` (72)

Sums 34, 42, 47. `need` for `@capacitor/browser` is `external browser sign-in` (k.return opens the sign-in in an external browser that shares no cookie with the app).

The reader still learns what to do. The line names the package and the exact version; the `fix`, printed under it in compact and pretty, is the `package.json` hunk adding or setting it under `dependencies`; `keel explain E1572` reads "A shell also needs each native plugin its target names in package.json dependencies, at the exact version given" (its summary gains the five words `in package.json dependencies`; the entry exists today in `EXPLANATIONS.ts`).

The storage and shell-package form is unchanged: `<deployable>: <want> needs <dep> in package.json dependencies`, at most `<deployable>` + 66 (`capacitor needs @keel/std-capacitor`).

### E1575
k.shell Rules states the template the build prints, `<tool> missing or too old: needs <need>`, fixed text 27, with `tool` and `need` at most 60 together: at most 87 units. The longest today is `Android SDK missing or too old: needs ANDROID_HOME set to an SDK with platform-tools` (84; sum 57); the others are 73 (`cap`), 55 (`xcodebuild`, macOS), 54 (`webkit2gtk-4.1`) and less.

### Closing the hole
k.shell gains one clause measuring both forms at their bounds over the stub target, through `keel check` and `keel build --target tauri`: a `plugins` entry of 50 characters gives a 71-unit E1572 (`web: tauri needs ` is 17, ` ` 1, ` (` and `)` 3), and a `tools` entry of 60 gives an 87-unit E1575, each stated whole. k.check is at its 3,100-token cap and gains nothing; #23 stays one fixture per code.

### Sweep
Every message template in `spec/` with placeholders or a fixed text past 50 units, measured at the longest real input the tree gives (deployable names `web` and `api`; module, store and transaction ids up to 21, `shopping.startRestock`):
- Plain overruns of E1572's kind (a `diag` record clipped at real values): E1572's plugin form (112), fixed above. No other.
- `diag` records that fit at real input and carry an unbounded app name or path, the clip their net: E1589 `<name> (static) serves no router, ...` (80 + name; `marketing` gives 89) and `<name> (client) has no servedBy: ...` (69 + name); E1580 `... identityMount('<literal>') ...` (77 + literal); E1592 `<id> pages are on another origin; ...` (59 + id); E1258 (57 + prop); E1108's `<names>` and `(<rule>)` forms (66 at `temporal.Instant`); E1573 (`web: capacitor id "golden" ...`, 63 + id); E1153 (a cycle of ids); E1013 and E1004 (shortened by their own rules); E1572's storage form (66 + deployable); E1574's two texts (62, 70); E1571 (73); E1757's two (60, 72); E1577 (37 + route id).
- Thrown errors (k.errors `KeelError`, printed whole by vitest, a T0001 line clipping them): E1716 `<tx> leaves the safe integer range from this state; bound the schema or guard it` (77 + tx; 98 at `shopping.startRestock`), by design two lines with its JSON; E1708 `explore <store>: <transaction> broke an invariant after <n> steps (<k> states)` (52 + names; 91 with `shopping.runs`, `shopping.startRestock`, 12 steps and 340 states); E1715 (54 + tx + construct); E1727 and E1728 (a list of labels). Not changed here.
- Build lines (no `diag` record, never clipped): E1007 `server code in browser build: <reason>: <entry> -> <a> -> <file>` (30 + reason + chain; past 100 at its own conformance's three-step chain). E1011 was front-shortened by RFC 0222; E1007 is not. Not changed here (For the operator, 6).
- Messages built from a thrown error's text (E1159 `cannot be imported (<why>)`, E1053): no template in `spec/`; the clip is their net.

## Alternatives
- **Keep `in package.json dependencies` and bound `need` to about 15.** `web: capacitor needs @capacitor/browser 8.0.5 in package.json dependencies (` is already 74; a need of 14 says nothing. The fix and `keel explain` carry the place.
- **Drop `<deployable>:`.** The position is the deployable's key, but the prefix matches E1573's and the storage form's, and costs 5 units at the tree's names.
- **Widen #23 to every message form of every code.** It needs a fixture per form, CLI forms through the binary, and k.check has no room. The bound and one clause close the hole where package text enters.
- **A diagnostic for an over-long target entry.** It would be the target author's, not the app's, and the clip already keeps the record valid.

## Spec diff
Applied in this commit.
- k.shell (to `implemented` until its new clause is covered): Plugins bounds the three texts at 50 together and states the template without `in package.json dependencies`; Rules states E1575's template and its 60-character bound; Conformance gains one clause, appended.
- std.capacitor (stays `conformance-covered`, no clause added): the Plugins table's `@capacitor/browser` need is `external browser sign-in`; the `keel check` clause states its two messages whole.
- Map: the k.shell row reads `implemented`.
- No glossary term, section or code is added.

## Conformance diff
By the `conformance-writer`, from the spec text, under `rfc:0228`.
- `packages/cli/conformance/shell-plugins.test.ts`: line 4's Plugins quote takes the new template; line 55 expects `` `web: tauri needs ${p} ${v} (${n})` ``; lines 109 and 136 expect `web: tauri needs @x/p 1.2.3 (n)`. The `need` arbitrary (line 24, up to 39 characters) is narrowed so plugin (at most 18), version (at most 8) and need hold 50 together: `^[a-z][a-z ]{0,22}$`.
- `packages/cli/conformance/shell-message-bounds.test.ts` (new): the new k.shell clause, over `shell-stub.ts`. The E1572 is `web: tauri needs @aaaaaaaa/bbbbbbbb 10.20.30 (nnnnnnnnnnnnnnnnnnnnnnnn)`, 71 units; the E1575 is 30 `t`s, ` missing or too old: needs `, 30 `n`s, 87 units; each the whole `message`, not ending in `...`.
- `packages/std-capacitor/conformance/shell-plugins.test.ts`: line 3's quote takes the new clause text; `NEEDS` (line 43) holds `external browser sign-in`; `line()` (165) builds `` `web: capacitor needs ${plugin} ${pinned(plugin)} (${NEEDS[plugin]})` ``; the case at 229 is named for the clause's new words. Its four expectations (203, 212, 232, 242) then read, with today's pins: `web: capacitor needs @capacitor/preferences 8.0.1 (storage)`, `web: capacitor needs @capacitor/app 8.1.2 (launch and return links)`, `web: capacitor needs @capacitor/browser 8.0.5 (external browser sign-in)`.
- No `std-tauri` or `packages/check` conformance pins the plugin form: `std-tauri`'s cases assert no E1572, and `packages/check/conformance/E1572.test.ts` covers the storage form, unchanged. `shell-target-tools.test.ts` and the E1575 cases of `std-capacitor` and `std-tauri` match by inclusion and hold.

## Migration
None. No app is released.

## Token impact
- Spec: k.shell 3,004 to 3,097 tokens, of 3,100; std.capacitor 1,797 to 1,811; the map 1,519 to 1,517. k.cli, k.check, k.drive untouched.
- `keel explain E1572`: five words.
- `@keel/check`, `@keel/cli`, `@keel/std-capacitor`: a shorter template and string; sizes fall.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the three files above. 3. Build:
- `packages/check/src/dependencyNeed.ts`: ` in package.json dependencies` only when no `version` is given; its unit test `packages/check/test/dependencyNeed.property.test.ts:63`.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1572's summary as above.
- `packages/std-capacitor/src/tools/capacitorPlugins.ts`: the new need; its unit test `packages/std-capacitor/test/capacitorPlugins.test.ts` (the 50-character sum in place of 60 per need).
- `packages/cli/src/types/ShellTarget.ts`: the doc comment's bounds (50 together; `tools` 60 together).
- Docs: a changeset; `tasks/BACKLOG.md` 1061 closed.
- The ledger: the new k.shell clause at `none` until covered (`ledger-fresh` lists it; the orchestrator regenerates).
