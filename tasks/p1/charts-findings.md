# Charts library: where the skills and the format failed a library author

Lane `lane-charts` (task 0963). Library `libraries/charts`, package `@keel-libs/charts`, module id `charts`. These notes are the first draft of a library author's skill and the findings against the library format (RFC 0163).

## Name

`@keel-libs/charts`. The format allows `@keel/charts` (k.library Kind asks only for a scoped name), but `@keel/*` reads as kernel or stdlib everywhere: the structure lint, budgets and hygiene treat `@keel/*` as `packages/*`, k.library-pack treats an unmarked `@keel/std-*` specially, and an app author cannot tell a third-party library from the kernel by its name. A scope the project owns for non-kernel libraries keeps the line clear. A rename touches `package.json` `name`, the README and the `deps` entries that name it; the module id `charts` stays.

## Where the skills failed a library author

1. `keel` skill, Libraries: gives `keel scaffold library @acme/charts` but not where it writes (`<base>/` in the working directory) or that it writes a `tokens.ts` fixture. Needed `keel docs k.library-pack` (Scaffold); `keel scaffold --help` is E1052 and `keel help scaffold` is E1051.
2. Scaffold inside a pnpm workspace writes `^0.0.0` ranges for `@keel/*`; a workspace needs `workspace:*`. Nothing says so; I edited `package.json` by hand.
3. `keel-client`, Host: says nothing on colour in a library. A library cannot name a token (the app's `tokens.ts` is unknown to it; any style prop token in a library binds every app to having that token). The answer, pieced from k.host-code (`currentColor` from `fg`) and k.aria (Part styles, `props.styles` collected at the call site), is: draw in `currentColor`, take a `styles` prop of `PartStyle` per part, spread it onto the `Host`. No skill states this pattern.
4. No chart pattern for a text alternative and the numbers without sight: `docs/A11Y-TARGET.md` and k.a11y have no chart guidance, and the style vocabulary has no `position`, so there is no visually hidden table. I used `Host role="img"` with `label`, `describedBy` a visible summary line, and a disclosure button (`Part role="button" expanded controls`) over a `Part role="table"` with `hidden`. A skill should give one pattern.
5. Numbers for a person: E2301 sends formatting to `std-i18n`, a stdlib dependency a kernel-peers-only library cannot take. I made each point carry `shown`, the app's formatted value. No skill says how a library shows numbers.
6. `Part` in JSX: k.aria says app code uses `Part` "as the stdlib does" (the stdlib calls it as a function). As a JSX tag with children it fails `tsc` (finding F1). The skills never show `Part` in JSX.
7. `keel-testing`, properties: the skill does not say that `properties(Component)` generates the `id` prop too, so a library component whose ids build on `id` gets ids like `"` (finding F2).
8. `keel-testing`: a test-only wrapper component cannot be written in JSX, and a `.ts` one gets no `Props` attached (finding F3). Not mentioned.
9. Negative type tests: `render(Chart, { props })` does not reject a missing or mistyped prop for a component imported through a re-export (`export { default as X }`), so `@ts-expect-error` lines over `render` are unused (TS2578). Calling the component as a function (`BarChart({...})`) types the props. The skill says `render` types callback props; it does not say this.

10. Peer ranges in a workspace: `workspace:*` packs to an exact `"0.0.0"` peer, so a stranger's app at any other kernel version fails the peer; `workspace:^` packs to `^0.0.0`, the scaffold's own range. The tarball also carries the repo's `"private": true`, which a publish refuses. Nothing says which workspace protocol a library uses or what a release flips.
11. A workspace-linked library resolves for `keel check` (the `keel` condition, `src/`) but not for the app's `tsc --noEmit` (the `types` condition, `dist/`) until the library's `pnpm build` has run: the household check script failed TS2307 `Cannot find module '@keel-libs/charts'` on a fresh tree. Root `pnpm build` orders it through turbo; a lone app check does not. No skill says so.
12. The scaffolded library has no formatter, and `keel check` and `keel pack --check` do not format, so the library passed its own gates and failed the root format gate (F0001, six files). Inside the monorepo a library needs `biome format` as the packages do; an outsider's library chooses its own.
13. Charting money: a chart has one numeric axis, so an app with receipts in several currencies draws one chart per currency (the household page keys a `For` by currency, ids `receipts.spend.<currency>`). A skill line: one chart per unit, `value` in minor units, `shown` from `formatMoney`.

## Findings against the format

F1. `Part`'s `children` is typed `Children` (a thunk) only, while base elements take `Child | Children`. JSX children are typed as values, so `<Part role="button">Show</Part>` fails `tsc` (TS2322 `string` is not assignable to `Children`), though the compiler delivers JSX children as a thunk at run time. Reproduce: in a scaffolded library, render `<Part id={`${props.id}.b`} role="button">Show</Part>` from `@keel/ui/aria`; `keel check` reports E1751 TS2322. Meanwhile: `children={() => ...}` as an explicit prop. Spec: k.aria Part "takes ... a `children` thunk"; k.component "JSX children are the default slot, delivered as `props.children: () => Node | Node[] | string`". The type should accept JSX children as base elements do.

F2. No schema for an element id. A library component's ids build on its `id` prop (E1161), typed `s.string()` (the scaffold's `Example` too), so `properties(Component, { runs: 100, seed })` generates ids such as `"`, and axe-core then throws in happy-dom: `E1704 ... E1703 axe-core rule button-name threw: Failed to execute 'querySelector'` (seed 20261125, run 2, props `{"id":"\""...}`). App code may declare no format (E1106), so a library cannot narrow the id. Meanwhile: probes in `test/` under a fixed id.

F3. Files under `test/` are not compiled by the Keel Vite plugin (`NOT_APP` in `packages/compiler/src/vite.ts`), so a `.tsx` test wrapper fails to parse ("Unexpected JSX expression"), and a `.ts` wrapper exporting `Props` gets no schema attached (`schema.invalid component has no Props`). Meanwhile: `.ts` probes that call the chart as a function and assign `Probe.Props = Props` by hand. Spec: k.testing renders "by the Props schema the compiler attaches (a component file exporting Props)".

F4. `keel ledger --write <path>` with a path outside the project throws an uncaught `Error: refusing to write outside <root>: <path>` with a Node stack trace (`applyWrites.ts:33`), not a diagnostic record (docs/OUTPUT.md). Reproduce: in `apps/household`, `keel ledger --write "$TMPDIR/l.json"`.

F5. An app that uses `BarChart` alone ships the other charts' host code as chunks nothing references: the stranger's `keel build` wrote `lineCode`, `sparkCode` and `lineLayout` chunks (1.9 KB) beside `barsCode` in `dist/web/assets`, and the entry chunk names none of them. Each `code={() => import(...)}` target of a component the barrel re-exports is emitted even when the component is shaken out.

F6. A workspace-linked library is not installed (`libraryLedgers` reads a shipped `.keel/ledger.json` only under `node_modules`), so the app's ledger lists `@keel-libs/charts` under `libraries` with its recounted `unsafe` 0 and `hostElements` 3 and none of its 17 exports or rungs. The library's evidence shows only in its own `.keel/ledger.json` until it is installed from a tarball.

## State

Done: the three charts (`BarChart`, `LineChart`, `Sparkline`) with tests; in `libraries/charts` `pnpm check` (`keel check`, `keel pack --check`) and `keel test` ok. Workspace wiring: `pnpm-workspace.yaml`, `tooling/turbo.mjs`, `tooling/structure-lint.mjs` (S0015), voice lint over `libraries/*/README.md` and `libraries/*/src`, and the CI keel test step with `--filter "./libraries/*"` (ci.yml generated). In use: household's receipts page draws what each member paid per currency (`spendOf`, `BarChart`), with a `renderRoute` test and `spendOf` example and seeded property tests; household `keel check`, `keel test` (185 tests), `keel build` ok; the ledger's `libraries` holds `@keel-libs/charts` (`unsafe` 0, `hostElements` 3) with no E1162. A stranger's round trip: `pnpm pack`, the tarball installed in a scaffolded project under `$TMPDIR` (kernel packages linked from the repo), `keel check` and `keel build` ok, and a shipped ledger edited to `hostElements` 0 gives E1162.

## Evenly layer 6

Recommendation: the reader still writes a library in layer 6, because the chapter teaches the format ("a chart of your own"), but a small one, and `@keel-libs/charts` is the worked example beside it.

1. The reader scaffolds `@evenly/charts` with `keel scaffold library` and writes one component, `BalanceBars`: who is owed and who owes, a signed bar per member. That is the chapter's whole chart; line charts and sparklines are not needed in Evenly.
2. `BalanceBars` follows the patterns this library settled, which the layer's text states once: ids built on `id` (the layer's mistake, E1161); marks in `currentColor` with a `styles` prop the app fills from its tokens; `label`, a visible `summary` and the values as a table behind a disclosure button; each point's `shown` formatted by the app with `formatMoney`, one chart per currency (13); a seeded property test under a fixed id (F2).
3. The chapter ends by pointing at `@keel-libs/charts` as a fuller library of the same shape, which a reader installs from its tarball rather than writing their own, and shows the one line of `deps` and the ledger's `libraries` entry that installing it adds.
4. Before the layer is written: F1 to F3 fixed or taught as the reader's workarounds (a tutorial should not teach `children={() => ...}` and `.ts` probes if a fix is near), and the library skill drafted from items 1 to 13 so the reader's agent has it. Put the library at `libraries/evenly-charts`, not `apps/evenly-charts`: the tooling now reads `libraries/` for S0015, voice lint and the CI keel test step.
