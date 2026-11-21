# host-component

A custom component on the `Host` element. `modules/app/HomePage.tsx` renders a `Host` that outside code owns: `modules/app/barChart.ts` draws one SVG bar per month with `hostCode`, and redraws on `update` when the value changes. Keel checks the value against the `Bars` schema and names the drawing with `role="img"` and a `label`. The list under the chart is its text alternative, linked by `describedBy`.

The server sends the `Host` node empty and the browser draws it. `test/chart.test.ts` reads the chart's role, name and value; the harness never runs the drawing code. Run `keel check`, `keel test` and `keel build`; `node dist/web/server.mjs` serves the page.
