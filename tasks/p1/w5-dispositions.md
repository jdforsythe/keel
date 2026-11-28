# W5: dispositions of the skill trial findings

Sources: `evenly-findings.md` (E1 to E18), `charts-findings.md` (C1 to C13, F1 to F6), `app-trials.md` ranked list (T1 to T10). a: a skill sentence; b: a Keel defect, backlog line; c: fixed on the main line.

| finding | source | a/b/c | where it went |
|-|-|-|-|
| E1 status text example is a function child and calls a signal | evenly | a | keel-client A11y: `{status.get()}`, `status` a signal |
| E2 signals read `.get()`, write `.set()` | evenly | a | keel-client Components: `signal(initial)` from `@keel/reactive` |
| E3 `Link` takes `to` | evenly | a | keel-client Forms, routes, title |
| E4 `Dialog` `trigger` is content only; E1703 fix repeats the message | evenly | a, b | keel-client Widgets; fix line in 1132 |
| E5 `focusOrder()` lists controls in a closed Dialog | evenly | b | 1129 |
| E6 how a test submits a `<Form>` | evenly | a | keel-testing: `fire(<submit button id>, { type: 'submit' })` |
| E7 a function property needs fast-check with a seed | evenly | a | keel-testing Ledger rungs (`fc.assert`, `devDependencies`); seedless calls stay with 1116 |
| E8 `prove` has no sum; a format field has no sort | evenly | a | keel-testing `prove` line |
| E9 `f.field('parts.0')` cannot submit | evenly | b | 1130 |
| E10 template record path types as `string`; E1405 diff | evenly | b | 1131 |
| E11 a client-only app's POST action in `*.server.ts` | evenly | a | keel-client Forms (keel-server states it too) |
| E12 `s.array`/`s.record` one argument; `store.get(key)` | evenly | a | keel Shape (file name per export was already there, E1752) |
| E13 E1005 after an edit until `keel build` | evenly | a | keel Commands; the defect stays with 0461 and 1012 |
| E14 fix lines with no diff or stack frames | evenly | b | 1132; keel names `crypto.randomUUID` under E1601 |
| E15 document title is the deployable name | evenly | a | keel-client Forms, routes, title |
| E16 std packages unnamed | evenly | a | keel-client Text names `@keel/std-i18n`, `std-money`, `std-temporal`, `Locale`; widgets were named |
| E17 no way to open the built app in a browser | evenly | b | 1133; keel-deploy already states the host's fallback and `csp.txt` |
| E18 count line without plural forms | evenly | a | keel-client Text: every count line |
| C1 where `scaffold library` writes; `--help` | charts | a, b | keel-library Scaffold; 1134 |
| C2 scaffold ranges inside a pnpm workspace | charts | b | 1135 (outside the Keel repo `^<version>` is right) |
| C3 colour in a library | charts | a | keel-library Colour |
| C4 a chart's text alternative and table | charts | a | keel-library, with a compiled example |
| C5 numbers a library shows | charts | a | keel-library Numbers (a library may also list a std package as a peer) |
| C6 `Part` in JSX | charts | a, b | keel-library (`children={() => ...}`); 1136 |
| C7 `properties` generates the `id` prop | charts | a | keel-library Ids; defect F2 |
| C8 test-only wrapper component | charts | b | 1138 (F3) |
| C9 `render` does not reject a mistyped schema prop | charts | a | keel-testing: `render` types schema props `unknown`, call the component |
| C10 `workspace:^` peers; `"private": true` | charts | c | `a4bf13a0` (charts peers); `private` is lifted at release (`tooling/publish-exports.mjs`) |
| C11 app `tsc` needs the linked library built | charts | a | keel-library In an app |
| C12 no formatter in a scaffolded library | charts | a, b | keel-library Its folder; monorepo part in 1135 |
| C13 money: one chart per currency | charts | a | keel-library Numbers |
| F1 `Part` children thunk only | charts | b | 1136; confirmed by docs-check (TS2322 on text between `Part` tags) |
| F2 no schema for an element id | charts | b | 1137 (beside 1106) |
| F3 `test/` not compiled | charts | b | 1138 |
| F4 `keel ledger --write` outside throws | charts | b | 1139 |
| F5 unused host code chunks shipped | charts | b | 1140 |
| F6 a linked library shows no exports in the ledger | charts | a | keel-library In an app (k.library states it: installed vs linked) |
| T1 kit ships two missing type entries | app trials | c | `ce014d5e` |
| T2 E1751 hides the root cause | app trials | a, b | keel-client (children of `If`, `Form` inline); 1141 |
| T3 kit defect looks like an app defect | app trials | a, b | keel Reading path (TS2688/TS2875: report `blocked: kit types`); 1142 |
| T4 harness never says why `pass()` is false | app trials | b | 1142 |
| T5 `keel docs std.*` needs the package installed | app trials | a | keel Reading path (E1065); its message already says `add <owner>` |
| T6 props read from `.d.ts` files | app trials | a | keel-client Components (`If when fallback`, `For each key` child, `Match on`, `Case tag`) |
| T7 scaffold module accepts a std id; starter `app` module | app trials | a, b | keel Shape (module `app`); 1144 |
| T8 probe and audit flaky | app trials | b | 1143 |
| T9 no sign of life during a run | app trials | b | 1143 |
| T10 start and not-found scripts | app trials | a, b | keel-deploy Run `server.mjs`; 1145 |

## Cut for size

- keel: the library steps (moved to keel-library), the `tokens.ts` line's `look` and `gap` clause (keel-client holds both), the format literal's examples and "data from outside reads with `parse`", W1608's reason, two "See" pointers, E1165 from the description (no sentence covered it).
- keel-client: fonts through `styles` (keel-deploy holds it), `text` throwing on a bad locale file, validation timing, the no-JS re-render sentence, the layout test's E1506 sentence, the closing Test pointer, the Host `S` inference note, table links working without JS, `mount` and `resume` taking `{ ctx }`, a cross-module link importing its contract; description parentheticals (for the `keel docs` map budget).
- keel-testing: the `keel session replay|minimize|to-test` sentence (keel-compliance holds it), the closed-form `explore` sentence (the E1709 line holds it), the production-page sentence, three asides in `simulate`.
- keel-deploy: the `KEEL_DEV_POLL` watcher options, `KEEL_APP_DIR`, signing and store upload, E1552.
