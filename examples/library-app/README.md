# library-app

An app that lists a Keel library: `modules/app/module.ts` names `@example/library-charts` (`examples/library-charts`, linked by the workspace) in `deps`, and `HomePage.tsx` renders its `BarChart` with the id `app.rain`. `keel check` checks the library's files with the app's, under the app's `tokens.ts`; `keel build` compiles them as the app's own; `keel ledger` lists the library under `libraries` with the counts the app makes over its files.

Run `keel check`, `keel test` and `keel build`; `dist/web/index.html` holds the chart's element, `app.rain.chart`.
