// Spec: std.tables, clause "After Next on the next-to-last page, focus is on `status`."
// Seed: 1337.
// @vitest-environment happy-dom
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { PAGE_SIZE, SEED, focusedId, routes, simCtx, useRows } from "./fixtures.ts";

describe("std.tables: pager focus", () => {
  test("After Next on the next-to-last page, focus is on `status`", async () => {
    useRows(12); // three pages of five
    const h = await renderRoute("tbl.server", { routes, params: {}, search: { page: 2 }, ctx: simCtx() });
    expect(h.find("cat.pager").role).toBe("navigation");
    await h.fire("cat.next", { type: "focus" });
    expect(focusedId()).toBe("cat.next");
    await h.fire("cat.next", { type: "click" });
    await h.settle();
    // the last page has no Next: the focused link was removed, so focus moved to `status`
    expect(document.getElementById("cat.next")).toBeNull();
    expect(focusedId()).toBe("cat.status");
    expect(h.find("cat.status").role).toBe("status");
    expect(h.find("cat.status").text).toBe("Page 3 of 3");
    h.dispose();
  });

  test("for any table of three or more pages, Next on the next-to-last page leaves focus on `status` (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2 * PAGE_SIZE + 1, max: 60 }), async (n) => {
        useRows(n);
        const pages = Math.ceil(n / PAGE_SIZE);
        const h = await renderRoute("tbl.server", { routes, params: {}, search: { page: pages - 1 }, ctx: simCtx() });
        await h.fire("cat.next", { type: "focus" });
        await h.fire("cat.next", { type: "click" });
        await h.settle();
        expect(focusedId()).toBe("cat.status");
        h.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
    useRows(12);
  });
});
