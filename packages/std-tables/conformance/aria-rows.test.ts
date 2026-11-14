// Spec: std.tables, Conformance "A page-2 server table of 12 rows at size 5 has `aria-rowcount="13"` and rows `aria-rowindex` 7 to 11; `header.price` has `aria-sort="ascending"` under `sort=price` and no other header has `aria-sort`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: `aria-rowcount` and `aria-rowindex` are read with getElementById (the a11y state has no key for them); `aria-sort` through `find(id).state.sort` (k.testing).
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { PAGE_SIZE, SEED, attr, byPrice, dataset, ordered, routes, simCtx, useRows } from "./fixtures.ts";

const SHOWN = ["title", "price", "minutes", "added", "favorite"] as const;

describe("std.tables: server table rows and headers", () => {
  test('A page-2 server table of 12 rows at size 5 has `aria-rowcount="13"` and rows `aria-rowindex` 7 to 11; `header.price` has `aria-sort="ascending"` under `sort=price` and no other header has `aria-sort`', async () => {
    useRows(12);
    const h = await renderRoute("tbl.server", {
      routes,
      params: {},
      search: { sort: "price", dir: "asc", page: 2 },
      ctx: simCtx(),
    });
    expect(attr("cat.table", "aria-rowcount")).toBe("13");
    const whole = ordered(dataset.rows, byPrice);
    const onPage = whole.slice(PAGE_SIZE, 2 * PAGE_SIZE);
    expect(onPage).toHaveLength(5);
    onPage.forEach((row, i) => {
      expect(attr(`cat.row.${row.id}`, "aria-rowindex")).toBe(String(7 + i));
    });
    // rows of other pages are not rendered
    for (const row of [...whole.slice(0, PAGE_SIZE), ...whole.slice(2 * PAGE_SIZE)]) {
      expect(document.getElementById(`cat.row.${row.id}`)).toBeNull();
    }
    expect(h.find("cat.header.price").role).toBe("columnheader");
    expect(h.find("cat.header.price").state.sort).toBe("ascending");
    for (const col of SHOWN.filter((c) => c !== "price")) {
      expect(h.find(`cat.header.${col}`).state.sort).toBeUndefined();
    }
    h.dispose();
  });

  test("for any row count, page and sorted column, the counts and indexes follow the whole result (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 40 }),
        fc.constantFrom("title", "price", "minutes", "added"),
        fc.constantFrom("asc", "desc"),
        fc.integer({ min: 1, max: 4 }),
        async (n, sort, dir, wanted) => {
          useRows(n);
          const pages = Math.ceil(n / PAGE_SIZE);
          const page = Math.min(wanted, pages);
          const h = await renderRoute("tbl.server", { routes, params: {}, search: { sort, dir, page }, ctx: simCtx() });
          const shown = Math.min(PAGE_SIZE, n - (page - 1) * PAGE_SIZE);
          // the page holds fewer than `total` rows, so `rowCount` is `total + 1`
          expect(attr("cat.table", "aria-rowcount")).toBe(String(n + 1));
          const ids = h.a11y("cat.body").children.map((c) => c.id);
          expect(ids).toHaveLength(shown);
          ids.forEach((id, i) => {
            expect(attr(id, "aria-rowindex")).toBe(String((page - 1) * PAGE_SIZE + i + 2));
          });
          for (const col of SHOWN) {
            const want = col === sort ? (dir === "asc" ? "ascending" : "descending") : undefined;
            expect(h.find(`cat.header.${col}`).state.sort).toBe(want);
          }
          h.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
    useRows(12);
  });
});
