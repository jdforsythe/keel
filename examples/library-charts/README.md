# @example/library-charts

A Keel library, written by `keel scaffold library @example/library-charts`, with one chart added: `BarChart` (`src/BarChart.tsx`) renders one `Host` element, `<id>.chart`, whose outside code (`src/barsCode.ts`) draws an SVG bar per value. Its element ids are built from the `id` prop the app gives, and its `.keel/ledger.json` counts the one host element.

- `keel check` and `keel test` judge the library in this folder, against its `tokens.ts`.
- `keel pack` checks, tests and writes `.keel/ledger.json`; `keel pack --frozen` fails when the files and that file disagree.
- `pnpm pack` builds `dist/` and runs `keel pack --frozen` first.

`examples/library-app` lists it in a module's `deps` through the workspace link.
