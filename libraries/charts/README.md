# @keel-libs/charts

Bar charts, line charts and sparklines for Keel apps. Each chart draws an SVG inside one `Host`, takes its points through a schema, and gives a person who cannot see it the same numbers: the picture is named by `label`, described by a visible `summary` line, and a button opens the values as a table.

```tsx
import { BarChart } from "@keel-libs/charts";

<BarChart id="spend.week" label={text.chart} summary={text.summary} points={points} text={text.numbers}
  styles={{ chart: { fg: "accent" } }} />
```

- List `@keel-libs/charts` in a module's `deps`. Its module id is `charts`.
- A point is `{ name, value, shown }`: `value` is a finite number (NaN and Infinity fail the schema), `shown` is that value as your app formats it for a person (`12.40 €`, `85 ms`). The charts never format a number.
- Every word comes from your copy: `label`, `summary`, and `text` (`numbers` names the button, `name` and `value` head the table's columns).
- Colour comes from your tokens: marks and labels are drawn in `currentColor`, so `styles.chart.fg` picks it. Your `keel check` and `keel test` judge its contrast.
- Nothing moves, so reduced motion shows the same chart.
- Element ids build on your `id`: `<id>.chart`, `<id>.summary`, `<id>.button`, `<id>.table`, `<id>.row.<n>.name`, `<id>.row.<n>.value`.

In this folder `pnpm check` runs `keel check` and `keel pack --check`, and `pnpm test` runs `keel test`. `keel pack` writes `.keel/ledger.json`.
