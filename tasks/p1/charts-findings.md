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

## Findings against the format

F1. `Part`'s `children` is typed `Children` (a thunk) only, while base elements take `Child | Children`. JSX children are typed as values, so `<Part role="button">Show</Part>` fails `tsc` (TS2322 `string` is not assignable to `Children`), though the compiler delivers JSX children as a thunk at run time. Reproduce: in a scaffolded library, render `<Part id={`${props.id}.b`} role="button">Show</Part>` from `@keel/ui/aria`; `keel check` reports E1751 TS2322. Meanwhile: `children={() => ...}` as an explicit prop. Spec: k.aria Part "takes ... a `children` thunk"; k.component "JSX children are the default slot, delivered as `props.children: () => Node | Node[] | string`". The type should accept JSX children as base elements do.

F2. No schema for an element id. A library component's ids build on its `id` prop (E1161), typed `s.string()` (the scaffold's `Example` too), so `properties(Component, { runs: 100, seed })` generates ids such as `"`, and axe-core then throws in happy-dom: `E1704 ... E1703 axe-core rule button-name threw: Failed to execute 'querySelector'` (seed 20261125, run 2, props `{"id":"\""...}`). App code may declare no format (E1106), so a library cannot narrow the id. Meanwhile: probes in `test/` under a fixed id.

F3. Files under `test/` are not compiled by the Keel Vite plugin (`NOT_APP` in `packages/compiler/src/vite.ts`), so a `.tsx` test wrapper fails to parse ("Unexpected JSX expression"), and a `.ts` wrapper exporting `Props` gets no schema attached (`schema.invalid component has no Props`). Meanwhile: `.ts` probes that call the chart as a function and assign `Probe.Props = Props` by hand. Spec: k.testing renders "by the Props schema the compiler attaches (a component file exporting Props)".

## State

Done: the three charts (`BarChart`, `LineChart`, `Sparkline`), shared table disclosure, layout functions, tests (examples, seeded properties over components and layouts, schema refusal of NaN and Infinity, negative type test). In `libraries/charts`: `keel check` ok (33 files), `keel test` ok (17 tests), `keel pack` ok (0 unsafe, 3 hostElements, 17 exports), `keel pack --check` ok. `pnpm-workspace.yaml` lists `libraries/*`.

Not done (next, in order):
1. Workspace wiring: `tooling/turbo.mjs` `workspaceDirs` and `tooling/structure-lint.mjs` (`appTests`, S0015) to read `libraries/`; voice lint for `libraries/*/README.md`; `tooling/ci.source.json` keel test step to add `--filter "./libraries/*"`, then `node tooling/generate.mjs`.
2. Use in one golden app (golden-2 timings or market, or household spend per week): workspace link, `deps`, one chart, a `renderRoute` test; app `keel check`/`test`/`build`; ledger `libraries` entry with no E1162.
3. The stranger's round trip: `pnpm pack`, install the tarball in a scratch app outside the repo, `keel check`, `keel build`.
4. Root `pnpm build` and `pnpm check --quiet` steps one by one.
5. Evenly layer 6: recommendation pending (leaning: consume this library for charts and keep the reader's own small library as the authoring exercise).
