// Spec: std.tables, Conformance "`sort.price` links to `dir=desc` when sorted `asc` by price, drops `page`, and after its activation focus stays on it and scroll is unchanged."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: scroll is read as `window.scrollY` under happy-dom, as k.router's own scroll tests do; a link click inside the router navigates client-side.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, focusedId, paramsOf, routes, simCtx, useRows } from "./fixtures.ts";

const SORTS = ["title", "price", "minutes", "added"] as const;

describe("std.tables: sort links", () => {
  test.skip("`sort.price` links to `dir=desc` when sorted `asc` by price, drops `page`, and after its activation focus stays on it and scroll is unchanged", async () => {
    useRows(12);
    const h = await renderRoute("tbl.server", {
      routes,
      params: {},
      search: { sort: "price", dir: "asc", page: 2, currency: "USD" },
      ctx: simCtx(),
    });
    const link = paramsOf("cat.sort.price");
    expect(link.get("sort")).toBe("price");
    expect(link.get("dir")).toBe("desc");
    expect(link.has("page")).toBe(false);
    expect(link.get("currency")).toBe("USD"); // the same search otherwise

    await h.fire("cat.sort.price", { type: "focus" });
    window.scrollTo(0, 240);
    await h.fire("cat.sort.price", { type: "click" });
    await h.settle();
    expect(h.route()).toMatchObject({ id: "tbl.server", search: { sort: "price", dir: "desc", currency: "USD" } });
    expect(h.route()).not.toMatchObject({ search: { page: 2 } });
    expect(h.find("cat.header.price").state.sort).toBe("descending");
    expect(focusedId()).toBe("cat.sort.price");
    expect(h.find("cat.sort.price").state.focused).toBe(true);
    expect(window.scrollY).toBe(240);
    h.dispose();
  });

  test.skip("a sort link's `dir` is `desc` only on the column already sorted `asc`, else `asc`, and never carries `page` (property)", async () => {
    useRows(12);
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...SORTS),
        fc.constantFrom("asc", "desc", undefined),
        fc.integer({ min: 1, max: 3 }),
        async (current, dir, page) => {
          const h = await renderRoute("tbl.server", {
            routes,
            params: {},
            search: dir === undefined ? { sort: current, page } : { sort: current, dir, page },
            ctx: simCtx(),
          });
          for (const col of SORTS) {
            const link = paramsOf(`cat.sort.${col}`);
            const sortedAsc = col === current && dir !== "desc"; // `dir` defaults to `asc`
            expect(link.get("sort")).toBe(col);
            expect(link.get("dir")).toBe(sortedAsc ? "desc" : "asc");
            expect(link.has("page")).toBe(false);
          }
          h.dispose();
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });
});
