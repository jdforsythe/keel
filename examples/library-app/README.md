# library-app

An app that lists a Keel library: `modules/app/module.ts` names `@example/library-charts` (`examples/library-charts`, linked by the workspace) in `deps`, and `HomePage.tsx` renders its `BarChart` with the id `app.rain`. `keel check` checks the library's files with the app's, under the app's `tokens.ts`; `keel build` compiles them as the app's own; `keel ledger` lists the library under `libraries` with the counts the app makes over its files.

Its `tokens.ts` holds three themes: `slate`, a visitor's pick through the `ThemeSelect` on the page; `hc`, on under `prefers-contrast: more`, which spreads `@example/library-looks`' shipped contrast colors and is held to 7:1; and `paper`, the printed page's colors. The settings box is `media="screen"` and a closing line `media="print"`, so each shows only where it belongs.

Run `keel check`, `keel test` and `keel build`; `dist/web/index.html` holds the chart's element, `app.rain.chart`.
