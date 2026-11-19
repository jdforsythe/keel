// Spec: std.tables, Conformance "A client table over a store re-sorts when a transaction changes its rows and renders `empty` at `total` 0."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: `tx(transaction, payload)` may be called from a test with the route page mounted; `empty` is `() => Node`;
// the store is read as `rows: () => store.get("rows")` (a store read, k.store).
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { DataTable } from "@keel/std-tables";
import { type Store, store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  CELLS,
  CatalogRow,
  LOCALE,
  PAGE_SIZE,
  type Row,
  SEED,
  Search,
  TEXT,
  catalogColumns,
  queryOf,
  rowWith,
  simCtx,
} from "./fixtures.ts";

const Rows = s.object({ rows: s.array(CatalogRow) });
// store() must run inside a reactive scope.
const made = (() => {
  let out: Store<Infer<typeof Rows>> | undefined;
  scope(() => {
    out = store(Rows, { rows: [] }, { id: "tbl.rows" });
  });
  if (out === undefined) throw new Error("fixture: store scope did not run");
  return out;
})();
const add = transaction(made, "tbl.add", s.object({ row: CatalogRow }), (state, { row }) => ({
  ...state,
  rows: [...state.rows, row],
}));
const clear = transaction(made, "tbl.clear", s.object({}), () => ({ rows: [] }));

const links = manifest({
  "tbl.client": {
    path: "/client",
    params: s.object({}),
    search: Search,
    component: () => Text({ children: "target" }),
  },
});
const routes = manifest({
  "tbl.client": {
    path: "/client",
    params: s.object({}),
    search: Search,
    component: (props) => {
      made.uses([add, clear]);
      return DataTable({
        id: "cat",
        label: "Catalog",
        columns: catalogColumns,
        search: queryOf(props.search),
        href: (q) => links.href("tbl.client", {}, q),
        locale: LOCALE,
        rows: () => made.get("rows"),
        pageSize: PAGE_SIZE,
        text: TEXT,
        cells: CELLS,
        empty: () => Text({ id: "cat.none", children: "No rows" }),
      });
    },
  },
});
const withTitle = rowWith;

describe("std.tables: client table over a store", () => {
  test("A client table over a store re-sorts when a transaction changes its rows and renders `empty` at `total` 0", async () => {
    const h = await renderRoute("tbl.client", {
      routes,
      params: {},
      search: { sort: "title", dir: "asc" },
      state: [[made, { rows: [withTitle(1, "bravo"), withTitle(2, "delta")] }]],
      ctx: simCtx(),
    });
    expect(h.a11y("cat.body").children.map((c) => c.id)).toEqual(["cat.row.1", "cat.row.2"]);
    tx(add, { row: withTitle(3, "alpha") });
    await h.settle();
    expect(h.a11y("cat.body").children.map((c) => c.id)).toEqual(["cat.row.3", "cat.row.1", "cat.row.2"]);
    expect(document.getElementById("cat.none")).toBeNull();

    tx(clear, {});
    await h.settle();
    expect(h.a11y("cat.body").children.map((c) => c.id)).not.toContain("cat.row.1");
    expect(h.find("cat.none").text).toBe("No rows");
    h.dispose();

    const empty = await renderRoute("tbl.client", { routes, params: {}, state: [[made, { rows: [] }]], ctx: simCtx() });
    expect(empty.find("cat.none").text).toBe("No rows");
    empty.dispose();
  });

  test("after any added rows the body is the rows ordered by `sort` and `dir` with ties by key (property)", async () => {
    const titleArb = fc.constantFrom("alpha", "bravo", "charlie", "delta");
    await fc.assert(
      fc.asyncProperty(
        fc.array(titleArb, { maxLength: 3 }),
        fc.array(titleArb, { minLength: 1, maxLength: 2 }),
        fc.constantFrom("asc", "desc"),
        async (initial, added, dir) => {
          const start = initial.map((t, i) => withTitle(i + 1, t));
          const more = added.map((t, i) => withTitle(100 + i, t));
          const h = await renderRoute("tbl.client", {
            routes,
            params: {},
            search: { sort: "title", dir },
            state: [[made, { rows: start }]],
            ctx: simCtx(),
          });
          for (const row of more) tx(add, { row });
          await h.settle();
          const sign = dir === "asc" ? 1 : -1;
          const want = [...start, ...more]
            .sort((a, b) => sign * (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) || a.id - b.id)
            .map((r) => `cat.row.${r.id}`);
          expect(h.a11y("cat.body").children.map((c) => c.id)).toEqual(want);
          h.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});
