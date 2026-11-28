# RFC 0159: custom components: `Part` open to apps, the host element

Status: implemented (ADR-0181). Workstream W15 step 1 of `tasks/p1/PLAN.md`; decisions D44, D48 and D50 of `tasks/0963-to-p1/PLAN.md`. The library format of D49 is RFC 0163 (ADR-0185).

## Decisions
- D1: `Part` (`@keel/ui/aria`) is open to app code. E1822 is retired, not narrowed, and its code stays reserved and is not reused: with `Part` open there is nothing left to guard, and its `unsafe/` re-export clause guarded only a way round E1822. `ariaImport.ts` and its tests go.
- D2: `Part` gains `grid` and `gridcell`, `tree` and `treeitem`, and `slider` and `radiogroup` with `radio`, the last three only as the platform's native controls (k.roles). The reasoning for each role is under Proposal.
- D3: the behaviour primitives made public are the two the stdlib widgets hold privately, `listChart` and `stableRows` (std.lists). There is no grid movement primitive, because none exists to expose. The stdlib keeps `checkKeys`, `nameOf`, `content` and `toastKey` private: they are plumbing for one widget's props, not behaviour.
- D4: D48's host element is `Host` from `@keel/ui` (k.host-element), with the glossary term **host element**. `host` has two other uses: the `host` key of a `client` deployable served by a `node` one (k.hosting), and k.host, "Host reads". Only the element is called "host element", always in full, so `<Host>` next to `host: 'api'` is not read as one concept.
- D5: D48's "a `Props` schema" is the element's `input` schema. `Props` names a component's own schema (k.component), and the host element code's value is not the component's props.
- D6: `role` is `'img'` or `'group'`. A text alternative (`label` or `labelledBy`) is required, and its absence is E1802. A long alternative, such as a data table, is ordinary app code beside the element, linked by `describedBy` or placed next to it.
- D7: the outside code arrives through `code={() => import("./x.ts").then((m) => m.x)}`. This is the one form there is (E1824). It keeps the library out of the server's run and out of pages that do not show the element, and it marks the host element code file for E1825.
- D8: data reaches the code by reference, never copied or serialized. `update` runs at most once per animation frame and is given the latest value and `prev`, so identity checks skip unchanged parts. The value is parsed by `input` in `dev` and in the harness, and not in production.
- D9: the code reports back only through `emit(e)`, parsed by an `events` schema. The runtime reports it as a `fire` of `type: 'emit'` and calls `onEvent`. Tests and sessions drive the element by `emit` without running the outside code.
- D10: `customElement(tag, { set, events? })` is the thin case. It is itself a `HostCode`, not a second mechanism.
- D11: the content security policy and Trusted Types stay as k.security fixes them. The trial below records what each library does under them.
- D12: a stylesheet import is allowed only in a host element code file (E1825). Today no rule stops a `.css` import anywhere, which is a global cascade (principle 2).
- D13: the ledger counts host elements (`hostElements`, E1706 on a rise), as it counts `unsafe`.
- D14: k.component says that a callback prop is typed and kept out of the schema in the same way as a slot prop. App components already take callbacks, and the date picker needs one.
- D15: `opened(at)` takes an index into `list`. On a closed list it opens with option `at` active, and with none when `at` is -1 or not below the list's length; on an open list it does nothing. This is `optionsChart`'s `open` event as it exists.
- D16: every state member of `ListState` (`list`, `index`, `open`, `activeId`, `rows`) is a `Computed`, read with `.get()`, and `stableRows` returns one too; the queries (`current`, `activeOption`, `indexOf`, `partId`, `back`) and the events are plain functions. This is the type in `internal/ListState.ts` today, and a `Computed` binds straight into a `Part` prop (k.aria), so the spec follows the code rather than wrapping members in calls.
- D17: a `customElement` `events` key is a DOM event type that the custom element dispatches, listened for on the created child (not the `div`) with `out.signal`. Its entry maps the event to an `E`, which goes to `out.emit` and is parsed by the `Host`'s `events` schema. The two `events` share only `E`. I kept the shared name, because both say "what this element reports", and the conformance already uses it.
- D18: `value` is a plain value (read once, so `mount` and never `update`), a signal or a computed (read with `get()`), or a compiled getter (k.component). A function is a plain value. The runtime reads it in one `computed`. A change requests a frame when none is pending, and the frame calls `update` unless the latest value `Object.is` the last one given.
- D19: `hostElements` is an integer at the ledger file's top level after `unsafe`, required as `unsafe` is, and an integer after `unsafe` in `keel-library.json`. It counts `<Host>` elements and `Host(...)` calls of `@keel/ui`'s `Host` in `src` and `unsafe` directories of `packages/*`, every file of `apps/*` and the root `modules/**` of an app, plus each library's count. `--scope` counts the apps in scope and writes the count without comparing it; E1706 compares only a run without `--scope`, because the committed count is for the whole repo.
- D20: under `mode: 'dev'` and in the harness, a value failing `input` is a `KeelError` `schema.invalid` thrown to the nearest `Boundary` (`data.at` the id), and no `mount` or `update` runs with it. There is no new code: it is the error every other parse failure raises. Production does not parse.
- D21: the host element's style clause lives in a new section, k.host-code, with `hostCode`, `emit` and `customElement`, because k.host-element and k.security are full.
- D22: k.roles gains an attribute table: ARIA names for ARIA state, HTML attributes for the native controls' own (`min`, `max`, `value`, `step`, `name`, `checked`, `disabled` on an `input`), `colspan` and `abbr`. No Keel-only attribute is written.
- D23: E1802 on `Host` runs without types: neither `label` nor `labelledBy`, both, or a blank literal `label`. A computed `label`, any `labelledBy` and a spread are left to the types and to `a11y()`. This is k.a11y's blank rule extended to `Host`, plus a presence check that other elements get only from the types, because a `Host`'s content gives assistive technology nothing to fall back on.

## Problem
An app needs components the stdlib does not ship, such as a date picker, a tree, a chart or a map, and today it has no blessed way to write them.
- `Part` is the only element with typed ARIA roles. E1822 (`packages/check/src/rules/ariaImport.ts:8-32`) keeps it from any file outside a top-level `packages/`, `node_modules/` or `.keel/`, and allows it under `unsafe/` without a re-export. An app widget can therefore be built only from base elements, which have no `grid`, `option` or `tab`, or by moving the file under `unsafe/`. The W15 gate forbids both of those.
- `Part`'s 24 roles (`packages/ui/src/aria/Part.ts:16-43`, the union in `PartProps.ts:41-82`) have no `grid`, `tree`, `slider` or `radio`. Nothing in the tree moves focus in two dimensions: the movement in `optionsChart.ts:26-52` works on one index, and no widget handles PageUp or PageDown.
- The stdlib widgets' list behaviour is private. `listChart` (`packages/std-headless/src/internal/listChart.ts:20`, which covers movement, typeahead, `activeId` and part ids) and `stableRows` (`internal/stableRows.ts:7`) are not exported. An app list widget would reimplement both and drift from the stdlib's keyboard model.
- Outside code has no place to run. App code cannot write a lowercase element (E1805) or touch `document` (E1252), and nothing hands it a node, a lifecycle, teardown or a text alternative. A chart today means `unsafe/` and an unchecked `effect`.
- The compiler already special-cases `Part` by import name for `styles` (`packages/compiler/src/internal/collectStyles.ts:182-186`) and for E1808 (`packages/check/src/rules/noEagerElement.ts:26`). Both apply to app files as they stand, so opening `Part` needs no compiler change.

## Proposal

### `Part` open (k.aria)
The import restriction and E1822 go. `Part` keeps everything else: the role table, `onKey`, `focus`, `activeDescendant`, dialog focus, and `styles` collection. App code then writes widgets exactly as the stdlib does, and a component's `styles` reach its parts by the same compiler path.

### The added roles (k.roles), one decision per role
The test I applied to each role: Keel offers it if it is a primitive, meaning an element plus its ARIA state whose behaviour is the component's own key map. Keel declines it if it is a widget, meaning the role is only correct together with behaviour that Keel would then own, or something that rebuilds a native control.
- **`grid`, `gridcell`.** These are primitives. A grid is a `table` whose cells take `selected`, `disabled`, `readOnly` and `current`, while movement belongs to the component (a date grid moves by day and week, and a spreadsheet grid moves by cell). `gridcell` always writes its role, because a `td`'s implicit role depends on its table's role. `columnheader` gains `abbr` for short weekday headers.
- **`tree`, `treeitem`.** These are primitives, for the same reason `listbox` and `option` are primitives under `Listbox`. They carry state (`expanded`, `level`, `setSize`, `posInSet`, `selected`), and the tree's keys are the component's, built on `listChart` over the visible items. A child list is a `group` given `list`, which renders a `ul`, so the HTML stays valid.
- **`slider`.** Keel offers it only as `input type=range`. The platform's range is the primitive: it already handles the arrow, Home, End and Page keys, pointer drag and value clamping. A `div` with role slider would rebuild all of that, which is a widget. A two-thumb range is a widget and is not covered.
- **`radiogroup`, `radio`.** Keel offers them only as native `input type=radio` inside a `div role=radiogroup`. The platform gives arrow movement and one tab stop over a shared `name`. A `div` with role radio needs roving focus, which is again a widget.

### Behaviour primitives (std.lists)
`@keel/std-headless` exports `listChart`, `stableRows` and `ListState` under their current names and signatures. The rest of its private helpers stay private (D3). Two-dimensional movement is written by the component as a pure function of the key and the current position (`moveDate` below). That function can be tested as a value, and the spec does not grow a key-map vocabulary.

### The host element (k.host-element)
The contract is given in k.host-element and k.host-code. Below is how it holds to the principles.
- **One node, owned outside.** The server writes an empty `div` carrying its role, name and size (style props such as `h` reserve the space, so the page does not shift). Resume claims the `div` and never its children, so nothing the outside code adds can cause E1253.
- **Driven by signals.** `value` is a plain value, a signal or computed, or the getter a JSX expression compiles to (D18). The runtime reads it in a `computed`. A change (`Object.is`) schedules one `update` per animation frame, carrying the latest value and `prev`. Store and loader values are immutable and kept by identity, so `value.points !== prev.points` is an O(1) check. A large series is never copied, diffed or encoded on its way in.
- **Client only, and split.** `code` is a literal dynamic import, so the server never evaluates d3 or Chart.js, a page without the element never downloads them, and the boundary walk (k.boundary) sees the chunk as client code.
- **Resume and teardown.** `mount` runs after the island resumes or mounts, in the next frame, once the import has resolved. Scope disposal cancels a pending frame, calls `dispose` once and aborts `out.signal`, so listeners the code added with `{ signal }` detach. A removal that comes before the import resolves runs nothing.
- **Errors.** A throw anywhere but `dispose` goes to the nearest `Boundary` with `data.at` set to the element's id. A throw from `dispose` is reported to the ctx and dropped, because teardown cannot be rolled back.
- **Tests and replay.** The harness never imports `code`. `find(id)` carries `value`, encoded by `input`'s codec, so a test asserts what the chart would draw as given state, then events, then the expected value. `fire(id, { type: 'emit', detail })` stands in for the outside code's events. A session records an `emit` as a `fire`, and `replay` applies it to `onEvent` without the library. The drawing itself is opaque, and the ledger says so by counting the element.
- **Policy.** The fixed policy holds inside the node (the trial is below). Tokens reach the code as `currentColor` from `fg` and as `var(--k-color-*)` through CSSOM (`selection.style()`), which the policy allows.

### The trial under the fixed policy
I served each library from a local Node server with the exact production header from `packages/server/src/csp/cspPolicy.ts`, enforcing, without the report directives. The page's nonce'd module created the Trusted Types policy `keel` before importing anything, as the runtime does. I ran Playwright 1.65 in Chromium and in WebKit, and both enforce `require-trusted-types-for` and `style-src`. The versions were d3 7.9.2, Chart.js 4.6.1, uPlot 1.6.32, Observable Plot 0.6.19 and ECharts 6.1.0. Nothing was committed, and the scripts sat in a scratch directory outside the repo.

| library | runs | blocked or degraded | why (source) |
| --- | --- | --- | --- |
| d3 | create, append, attr, scales, axes, line and area, transitions, zoom, brush, `.style()`, `.text()`, format | `.html()` throws (TrustedHTML); `.attr('style', …)` is set but not applied (`style-src-attr`) | `innerHTML` appears only in `selection.html`; `.style()` is CSSOM |
| Chart.js | line, bar, animation, responsive resize, tooltip, legend | none | canvas plus CSSOM only; no `<style>`, no HTML sink |
| uPlot | line, legend, cursor, drag zoom, with `uPlot.min.css` as a same-origin stylesheet | none | `el.style.*` only |
| Observable Plot | marks, axes, `tip` | degraded: the `<style>` it inserts into each figure is blocked, so the SVG loses `max-width: 100%` and a swatch legend loses its flex layout; a ramp legend's `data:` image is blocked (`img-src`) | `plot()` and `legend()` insert `<style>` on the core path; the `style` option uses CSSOM and works |
| ECharts | SVG renderer: series, legend, `richText` tooltip | canvas renderer: `init` throws (`innerHTML = ""` in zrender's canvas painter); the HTML tooltip throws; `renderToSVGString` needs a TrustedHTML sink to insert | `innerHTML` in the canvas painter, tooltip and DataView |

What an app can use: d3 (without `.html()` and the style attribute), Chart.js and uPlot in full. Observable Plot draws, but its layout CSS has to ship as a same-origin stylesheet in the host element code file (E1825 allows that), and ramp legends are out. ECharts works only with `renderer: 'svg'` and `tooltip.renderMode: 'richText'`. None of the five calls `eval` or `new Function` on a render path. App code has no Trusted Types policy of its own, which is intended: an SVG string from a library (`renderToSVGString`) has no way in except as a same-origin `Image`.

### Worked example 1: a date picker as an app component (`Part` open)
The date picker goes in golden-2 at `modules/recipes/`. It is a `Dialog` holding a `grid` of 6×7 cells, and the cells are keyed by position, so a cell's node survives a month change and keeps its focus. The arrow keys move by day and week, Home and End go to the start and end of the week, PageUp and PageDown move by month, and Shift with a Page key moves by year. Enter or Space chooses the date and closes the dialog. Escape dismisses it through `Dialog`. The grid has one tab stop: only the active cell has `tabIndex` 0, and its `focus` follows the active date. The grid comes before the month buttons in the source, because `Dialog` focuses the first focusable descendant when it opens (k.aria). That descendant is then the active date, and the visual order matches the Tab order (E1820).

`moveDate.ts`, the key map as a pure function:
```ts
import { addDays, PlainDate } from "@keel/std-temporal";
import type { KeyInput } from "@keel/ui/aria";

const day = (d: PlainDate): number => new Date(Date.parse(d)).getUTCDay();
const shift = (d: PlainDate, n: number): PlainDate | undefined => {
  const r = addDays(d, n);
  return r.ok ? r.value : undefined;
};
const addMonths = (d: PlainDate, n: number): PlainDate | undefined => {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const iso = new Date(Date.UTC(y, m, Math.min(Number(d.slice(8, 10)), last))).toISOString().slice(0, 10);
  const r = PlainDate.parse(iso);
  return r.ok ? r.value : undefined;
};

/** The date a grid key moves `d` to (APG Date Picker Dialog), or undefined for a key the grid does not take. */
export function moveDate(d: PlainDate, k: KeyInput): PlainDate | undefined {
  if (k.mod || k.alt) return undefined;
  switch (k.key) {
    case "ArrowLeft": return shift(d, -1);
    case "ArrowRight": return shift(d, 1);
    case "ArrowUp": return shift(d, -7);
    case "ArrowDown": return shift(d, 7);
    case "Home": return shift(d, -day(d));
    case "End": return shift(d, 6 - day(d));
    case "PageUp": return addMonths(d, k.shift ? -12 : -1);
    case "PageDown": return addMonths(d, k.shift ? 12 : 1);
    default: return undefined;
  }
}
```
`monthWeeks.ts` returns the 42 days that show `d`'s month, keyed by position:
```ts
import { addDays, type PlainDate } from "@keel/std-temporal";

export type Week = { readonly row: number; readonly days: readonly { readonly col: number; readonly date: PlainDate }[] };

/** Six weeks from the Sunday on or before the first of `d`'s month; a day of another month is in the list too. */
export function monthWeeks(d: PlainDate): readonly Week[] {
  const first = addDays(d, 1 - Number(d.slice(8, 10)));
  const start = first.ok ? addDays(first.value, -new Date(Date.parse(first.value)).getUTCDay()) : first;
  const base = start.ok ? start.value : d;
  return [0, 1, 2, 3, 4, 5].map((row) => ({
    row,
    days: [0, 1, 2, 3, 4, 5, 6].map((col) => {
      const r = addDays(base, row * 7 + col);
      return { col, date: r.ok ? r.value : base };
    }),
  }));
}
```
`DatePicker.tsx`. The copy comes from the app's message set through `text`, `monthTitle` and `dayName`, so the component holds none:
```tsx
import { computed, signal } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Dialog } from "@keel/std-headless";
import { PlainDate } from "@keel/std-temporal";
import { Box, Button, Heading } from "@keel/ui";
import { type KeyInput, Part } from "@keel/ui/aria";
import { monthWeeks } from "./monthWeeks.ts";
import { moveDate } from "./moveDate.ts";

export const Props = s.object({
  id: s.string(),
  today: PlainDate,
  text: s.object({ title: s.string(), previous: s.string(), next: s.string(),
    weekdays: s.array(s.object({ short: s.string(), long: s.string() })) }),
});

type Own = Infer<typeof Props> & {
  readonly value: () => PlainDate;
  readonly onChange: (d: PlainDate) => void;
  readonly monthTitle: (d: PlainDate) => string;
  readonly dayName: (d: PlainDate) => string;
};

/** A date picker (APG Date Picker Dialog): a Dialog holding a 6×7 `grid` of days; one tab stop, the active day. */
export default function DatePicker(props: Own) {
  const id = props.id;
  const active = signal<PlainDate>(props.value());
  const weeks = computed(() => monthWeeks(active.get()));
  const month = (d: PlainDate): string => d.slice(0, 7);
  const step = (n: 1 | -1): void => {
    const next = moveDate(active.get(), { key: n > 0 ? "PageDown" : "PageUp", shift: false, alt: false, mod: false });
    if (next !== undefined) active.set(next);
  };
  const onGrid = (k: KeyInput, close: () => void): boolean => {
    if (k.key === "Enter" || k.key === " ") {
      props.onChange(active.get());
      close();
      return true;
    }
    const next = moveDate(active.get(), k);
    if (next === undefined) return false;
    active.set(next);
    return true;
  };
  return (
    <Dialog
      id={id}
      title={props.text.title}
      trigger={() => props.value()}
      content={(close) => (
        <Box gap="2">
          <Heading id={`${id}.month`} level={3}>{props.monthTitle(active.get())}</Heading>
          <Part id={`${id}.grid`} role="grid" labelledBy={`${id}.month`} onKey={(k) => onGrid(k, close)}>
            <Part id={`${id}.head`} role="rowgroup" head>
              <Part id={`${id}.weekdays`} role="row">
                <For each={props.text.weekdays.map((w, col) => ({ col, ...w }))} key="col">
                  {(w) => (
                    <Part id={`${id}.weekday.${w.col}`} role="columnheader" abbr={w.long}>{w.short}</Part>
                  )}
                </For>
              </Part>
            </Part>
            <Part id={`${id}.days`} role="rowgroup">
              <For each={weeks.get()} key="row">
                {(week) => (
                  <Part id={`${id}.week.${week.row}`} role="row">
                    <For each={week.days} key="col">
                      {(c) => (
                        <Part
                          id={`${id}.day.${week.row}.${c.col}`}
                          role="gridcell"
                          label={props.dayName(c.date)}
                          selected={c.date === props.value()}
                          current={c.date === props.today ? "date" : false}
                          disabled={month(c.date) !== month(active.get())}
                          tabIndex={c.date === active.get() ? 0 : -1}
                          focus={c.date === active.get()}
                          onClick={() => active.set(c.date)}
                          p="1"
                          states={{ selected: { bg: "accent" } }}
                        >
                          {String(Number(c.date.slice(8, 10)))}
                        </Part>
                      )}
                    </For>
                  </Part>
                )}
              </For>
            </Part>
          </Part>
          <Box direction="row" gap="2">
            <Button id={`${id}.previous`} onClick={() => step(-1)}>{props.text.previous}</Button>
            <Button id={`${id}.next`} onClick={() => step(1)}>{props.text.next}</Button>
          </Box>
        </Box>
      )}
    />
  );
}
```
Its test, by id only:
```ts
const t = render(DatePicker, { props: { id: "dp", today: "2026-11-21", text, value: () => "2026-11-21",
  onChange: (d) => chosen.push(d), monthTitle: (d) => d.slice(0, 7), dayName: (d) => d } });
await t.fire("dp.trigger", { type: "click" });
await t.fire("dp.grid", { type: "keydown", key: "PageDown" });
expect(t.find("dp.month").text).toBe("2026-12");
expect(t.a11y("dp.grid")).toMatchObject({ role: "grid", name: "2026-12" });
```
The `focus` and `tabIndex` bindings read `active`, which makes the component an island. The cells keep their nodes across a month change, so `focus` turns from false to true only on the cell that becomes active, and that cell is focused after the commit (k.aria). Nothing in this example sits under `unsafe/` or switches off a rule. The W15 gate checks that when the build lands.

### Worked example 2: a d3 chart in the host element
This one also goes in golden-2 at `modules/recipes/`: recipes added per month, drawn as a line, with the same numbers in a table behind a `Disclosure`.

`MonthCount.schema.ts` and `AddedInput.schema.ts`, one export each:
```ts
import { s } from "@keel/schema";

export const MonthCount = s.object({ month: s.string(), label: s.string(), count: s.number() });
```
```ts
import { s } from "@keel/schema";
import { MonthCount } from "./MonthCount.schema.ts";

export const AddedInput = s.object({ points: s.array(MonthCount) });
```
`addedChart.ts`, the host element code file. It is loaded only in the browser, and it is the only file that imports d3:
```ts
import type { Infer } from "@keel/schema";
import { hostCode } from "@keel/ui";
import { axisBottom, axisLeft, create, line, max, scaleLinear, scalePoint } from "d3";
import type { AddedInput } from "./AddedInput.schema.ts";

type Input = Infer<typeof AddedInput>;
type Point = Input["points"][number];
const W = 640;
const H = 240;
const M = 32;

/** Recipes added per month as a d3 line; redraws only when the points array changes. */
export const addedChart = hostCode({
  mount(node: HTMLElement, value: Input) {
    const svg = create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("aria-hidden", "true");
    const x = scalePoint<string>().range([M, W - M]);
    const y = scaleLinear().range([H - M, M]);
    const xAxis = svg.append("g").attr("transform", `translate(0,${H - M})`);
    const yAxis = svg.append("g").attr("transform", `translate(${M},0)`);
    const path = svg.append("path").attr("fill", "none").attr("stroke-width", 2).style("stroke", "var(--k-color-accent)");
    const draw = (v: Input): void => {
      x.domain(v.points.map((p) => p.label));
      y.domain([0, max(v.points, (p) => p.count) ?? 0]).nice();
      xAxis.call(axisBottom(x));
      yAxis.call(axisLeft(y).ticks(5));
      path.datum(v.points).attr("d", line<Point>().x((p) => x(p.label) ?? 0).y((p) => y(p.count)));
    };
    draw(value);
    const el = svg.node();
    if (el !== null) node.append(el);
    return { svg, draw };
  },
  update(state, value, prev) {
    if (value.points !== prev.points) state.draw(value);
  },
  dispose(state) {
    state.svg.remove();
  },
});
```
`AddedChart.tsx`, the app component:
```tsx
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Disclosure } from "@keel/std-headless";
import { Box, Host } from "@keel/ui";
import { Part } from "@keel/ui/aria";
import { AddedInput } from "./AddedInput.schema.ts";
import { MonthCount } from "./MonthCount.schema.ts";

export const Props = s.object({
  points: s.array(MonthCount),
  text: s.object({ chart: s.string(), asTable: s.string(), table: s.string(), month: s.string(), count: s.string() }),
});

/** Recipes added per month: a d3 line in a host element, and the same numbers as a table. */
export default function AddedChart(props: Infer<typeof Props>) {
  return (
    <Box gap="2">
      <Host
        id="recipes.added.chart"
        role="img"
        label={props.text.chart}
        input={AddedInput}
        value={{ points: props.points }}
        code={() => import("./addedChart.ts").then((m) => m.addedChart)}
        w="full"
        h="chart"
        fg="text"
      />
      <Disclosure id="recipes.added.data" summary={() => props.text.asTable}>
        <Part id="recipes.added.table" role="table" label={props.text.table}>
          <Part id="recipes.added.head" role="rowgroup" head>
            <Part id="recipes.added.headRow" role="row">
              <Part id="recipes.added.monthHeader" role="columnheader">{props.text.month}</Part>
              <Part id="recipes.added.countHeader" role="columnheader">{props.text.count}</Part>
            </Part>
          </Part>
          <Part id="recipes.added.body" role="rowgroup">
            <For each={props.points} key="month">
              {(p) => (
                <Part id={`recipes.added.row.${p.month}`} role="row">
                  <Part id={`recipes.added.month.${p.month}`} role="rowheader">{p.label}</Part>
                  <Part id={`recipes.added.count.${p.month}`} role="cell">{String(p.count)}</Part>
                </Part>
              )}
            </For>
          </Part>
        </Part>
      </Disclosure>
    </Box>
  );
}
```
Its test never runs d3:
```ts
const t = render(AddedChart, { props: { points: [{ month: "2026-10", label: "Oct", count: 4 }], text } });
expect(t.find("recipes.added.chart")).toMatchObject({ role: "img", name: text.chart,
  value: { points: [{ month: "2026-10", label: "Oct", count: 4 }] } });
await t.fire("recipes.added.data.button", { type: "click" });
expect(t.find("recipes.added.count.2026-10").text).toBe("4");
```
`h="chart"` assumes a `size.chart` token in golden-2's `tokens.ts`, which the build step adds.

## Alternatives
- **Keep E1822 and widen the stdlib with a `DatePicker` and a `Tree`.** D50 rules out a framework date picker, and every pattern the stdlib does not ship would still be out of reach.
- **Narrow E1822 to some roles.** No role is harmful in an app, and the role table already types each role's props. A narrowed rule would be a second list to keep in step.
- **A `div role=slider` and `div role=radio`.** These rebuild native controls with their keyboard and pointer behaviour, and the first rule of ARIA says to use the native element.
- **A grid movement primitive (`gridMove`).** The stdlib holds none (D48: only what it already has), and movement differs per grid: a date grid moves by week, month and year, while a data grid moves by row and page. A pure function per component is smaller and testable as a value.
- **A drawing element, or managed SVG shapes.** D48 rules these out. A static SVG is an `Image`.
- **`ref`, or an `effect` with a DOM node, in any component.** Every component could then hold a node, and the harness, replay and the ledger could not tell which ones do. With one element there is one place to count and one place the harness treats as opaque.
- **Static imports of the library.** These evaluate it during server rendering and load it on every page of the chunk, and they give the check no file to allow a stylesheet in.
- **Copying or serializing the value on each update, or posting it to a worker.** The cost grows with the data, and nothing is gained while store values are immutable.
- **Letting host element code create its own Trusted Types policy, or adding `'unsafe-inline'` styles.** D46 and D48 keep `style-src` and Trusted Types absolute.
- **Calling the element `Foreign`, or by `host` alone.** `host` alone would collide with the deployable key and k.host; the term is "host element" in full (D4).

## Spec diff
- k.aria: the import sentence becomes "App code imports it as the stdlib does; the roles for app widgets: k.roles." E1822 leaves Rules, and its clause becomes "an app file importing `Part` reports no diagnostic". Status stays conformance-covered.
- k.roles (new, proposed): the seven roles, `abbr`, `group` `list`, native controls, and a pointer to std.lists.
- k.host-element (new, proposed): the element, its text alternative (E1802), `value`'s forms, the lifecycle, the parse, harness and replay, the ledger, and E1824.
- k.host-code (new, proposed): `hostCode`, `emit`, `customElement` and its `events`, styles and policy, and E1825.
- k.roles: the attribute table. std.lists: each member's type and `opened(at)`. k.ledger File and k.library: where `hostElements` sits.
- Map: rows for k.host-code; to stay inside the map budget the titles of k.roles, k.user and k.sync are shortened ("Part roles", "Request user", "Heads, writes").
- std.lists (new, proposed): `listChart`, `stableRows`, `ListState`. std.headless names them in its Package sentence.
- k.component: one sentence on callback props.
- Glossary: **host element**.
- k.testing, k.ctx and std.sessions are full. k.host-element states the harness's `value`, `fire` `emit`, the observer's `fire` of `type: 'emit'` and the ledger's `hostElements` count, and the build updates their types (`TestEvent`, `CtxEvent`, `SessionEvent`, the ledger file) to match.

## Conformance diff
The `conformance-writer` turns each section's Conformance list into tests under `rfc:0159`: k.roles and k.host-element in `packages/ui/conformance/`, std.lists in `packages/std-headless/conformance/`, and the changed k.aria clause in place of the E1822 test. These are the lists in `spec/kernel/k.roles.md`, `spec/kernel/k.host-element.md` and `spec/std/std.lists.md`, plus the k.aria clause "An app file importing `Part` from `@keel/ui/aria` reports no diagnostic, and its `styles` are collected as a stdlib component's." The host element clauses that need a browser frame run under Playwright, as k.aria's dialog clauses do, and the harness clauses run in Vitest.

Settled after the first conformance pass (the writer's assumptions, now in the text):
- std.lists: `activeId.get()`, and a new clause on `opened(at)`. `lists-support.ts`, `lists-active-id.test.ts` and `lists-move.test.ts` follow: they call `activeId()` and `index()`, and the members are `Computed`s.
- k.host-element: the update clause reads "Writing the signal `value` three times" (a stray "reads" removed); new clauses for a plain `value`, a reversal in one frame and the `dev` parse; the E1802 clause gives neither, both and blank. `host-update.test.ts` and `host-element-e1802.test.ts` follow their quotes; `host-support.ts`'s value assumption holds.
- k.host-code takes the Code, Events, customElement and Styles text and the `emit`, `customElement` and E1825 clauses, with two new clauses (the stylesheet asset, the policy in Chromium). `host-custom-element.test.ts`, `host-emit.test.ts`, `host-boundary-throw.test.ts`, `host-dispose.test.ts`, `host-update.test.ts`, `host-emit-replay.test.ts` and `host-element-e1825.test.ts` change their `Spec: k.host-element, Code|Events|Rules|Styles` headers to k.host-code.
- k.roles: one clause on the attribute table; `roles-grid.test.ts` and `roles-tree.test.ts` drop their assumption comments.
- k.host-element Ledger: `ledger-host-elements.test.ts` follows the reworded Ledger sentence.
- Already holds: k.component's callback-prop clause (`component-callback-props.test.ts`) passes today, since `render` passes a prop `Props` does not name through as it does a slot. k.aria's `styles` clause (`part-styles-app-part.test.ts`) passes today, since `collectStyles` adds `Part` imported from `@keel/ui/aria` to the base elements in any file. Both describe behaviour that exists; only the E1822 half of that clause needs the build.

## Token impact
k.host-element about 1,420 tokens and k.host-code about 930, against the 1,500 section limit; k.roles about 1,220; std.lists about 680; k.ledger stays under its limit (5,987 characters); k.library gains about 20. The map is at 4,996 of its 5,000 characters after one row and three shortened titles. k.aria falls by about 60.

## Build order
1. This commit: the RFC, ADR-0181, the spec and the glossary.
2. The `conformance-writer` writes k.roles, k.host-element and std.lists, and changes the k.aria clause.
3. The build (sonnet): open `Part` and add the roles (`TAGS`, `PartProps`); export `listChart` and `stableRows`; add `Host`, `hostCode`, `customElement`, the runtime lifecycle, the harness `value` and `emit`, E1824, E1825 and the ledger count.
4. W15 step 3: the two worked examples in golden-2, which must pass `keel check` and a11y with no rule off and nothing under `unsafe/`.

## For the operator
1. **A rule against stylesheets outside host element code (E1825).** This closes a global-cascade path that is open today. I recommend keeping it; no app in the tree imports a `.css` file.
2. **Parsing in production (D8).** Production skips the parse, for cost on large series. I recommend keeping that. The alternative is to parse every update everywhere, which is safer but O(n) per frame.
3. **A `Dialog` initial-focus prop.** The date picker orders its source so that the active day is focused first. APG puts the month buttons above the grid. I recommend leaving `Dialog` unchanged until a second app needs the other order.
4. **ECharts.** Its canvas renderer cannot run under Trusted Types. I recommend recording that limit in the docs and not adding a library policy, which would reopen D46's script decision.
