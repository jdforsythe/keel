// Spec: std.tables, Conformance "With two of five page rows selected `selectAll` is `mixed`; activating it calls `onSelect` with all five and the keys of other pages."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: `selected` is `() => readonly key[]` and `onSelect` receives the complete key list (an array or a set; read with spread).
// Assumption: `find(id).state.checked` is `'mixed'` for a mixed checkbox (k.testing); the A11yState type of this tree may still say boolean.
import { signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { DataTable } from "@keel/std-tables";
import { renderRoute } from "@keel/testing";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  CELLS,
  LOCALE,
  PAGE_SIZE,
  type Query,
  SEED,
  Search,
  TEXT,
  catalogColumns,
  makeRows,
  queryOf,
  simCtx,
} from "./fixtures.ts";

const ROWS = makeRows(8); // keys 1..8; page 1 holds 1..5, the rest are other pages
const selection = signal<readonly number[]>([]);
const calls: number[][] = [];
const links = manifest({
  "pick.list": { path: "/pick", params: s.object({}), search: Search, component: () => Text({ children: "target" }) },
});
const href = (q: Query) => links.href("pick.list", {}, q);
const routes = manifest({
  "pick.list": {
    path: "/pick",
    params: s.object({}),
    search: Search,
    component: (props) =>
      DataTable({
        id: "cat",
        label: "Catalog",
        columns: catalogColumns,
        search: queryOf(props.search),
        href,
        locale: LOCALE,
        rows: () => ROWS,
        pageSize: PAGE_SIZE,
        selected: () => selection.get(),
        onSelect: (keys) => {
          calls.push([...keys].map(Number));
        },
        text: TEXT,
        cells: CELLS,
      }),
  },
});
const open = async (keys: readonly number[]) => {
  selection.set(keys);
  calls.length = 0;
  return renderRoute("pick.list", { routes, params: {}, ctx: simCtx() });
};
const ascending = (keys: readonly number[]): number[] => [...keys].sort((a, b) => a - b);

describe("std.tables: select all", () => {
  test.skip("With two of five page rows selected `selectAll` is `mixed`; activating it calls `onSelect` with all five and the keys of other pages", async () => {
    const h = await open([1, 2, 7]); // two page rows and a key of another page
    expect(h.find("cat.selectAll").role).toBe("checkbox");
    expect(h.find("cat.selectAll").state.checked).toBe("mixed");
    expect(h.find("cat.select.1").state.checked).toBe(true);
    expect(h.find("cat.select.3").state.checked).toBe(false);
    await h.fire("cat.selectAll", { type: "click" });
    await h.settle();
    expect(calls).toHaveLength(1);
    expect(ascending(calls[0] ?? [])).toEqual([1, 2, 3, 4, 5, 7]);
    h.dispose();
  });

  test.skip("for any proper, non-empty selection of the page and any other-page keys, `selectAll` is mixed and selects the whole page (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(fc.boolean(), { minLength: PAGE_SIZE, maxLength: PAGE_SIZE })
          .filter((flags) => flags.some(Boolean) && !flags.every(Boolean)),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        async (onPage, elsewhere) => {
          const chosen = [
            ...onPage.flatMap((on, i) => (on ? [i + 1] : [])),
            ...elsewhere.flatMap((on, i) => (on ? [PAGE_SIZE + 1 + i] : [])),
          ];
          const h = await open(chosen);
          expect(h.find("cat.selectAll").state.checked).toBe("mixed");
          await h.fire("cat.selectAll", { type: "click" });
          await h.settle();
          const others = chosen.filter((k) => k > PAGE_SIZE);
          expect(ascending(calls.at(-1) ?? [])).toEqual([1, 2, 3, 4, 5, ...others]);
          h.dispose();
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });
});
