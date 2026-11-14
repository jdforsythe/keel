// @vitest-environment happy-dom
// The pager hands focus to `status` once, only for the link the page change removed: a later navigation, or focus
// that left the link first, pulls nothing.
import { renderRoute } from "@keel/testing";
import { describe, expect, test } from "vitest";
import { focusedId, routes, serverHref, simCtx, useRows } from "../conformance/fixtures.ts";

describe("pager focus handoff", () => {
  test("after Next onto the last page and focus leaving status, another navigation on that page moves nothing", async () => {
    useRows(12);
    const h = await renderRoute("tbl.server", { routes, params: {}, search: { page: 2 }, ctx: simCtx() });
    await h.fire("cat.next", { type: "focus" });
    await h.fire("cat.next", { type: "click" });
    await h.settle();
    expect(focusedId()).toBe("cat.status");
    await h.fire("cat.status", { type: "blur" });
    await h.navigate(serverHref({ page: 3, sort: "title" }));
    expect(h.route()).toMatchObject({ search: { page: 3, sort: "title" } });
    expect(focusedId()).not.toBe("cat.status");
    h.dispose();
  });

  test("focus that left the Next link before the page change is not pulled to status", async () => {
    useRows(12);
    const h = await renderRoute("tbl.server", { routes, params: {}, search: { page: 2 }, ctx: simCtx() });
    await h.fire("cat.next", { type: "focus" });
    await h.fire("cat.next", { type: "blur" });
    await h.navigate(serverHref({ page: 3 }));
    expect(document.getElementById("cat.next")).toBeNull();
    expect(focusedId()).not.toBe("cat.status");
    h.dispose();
  });
});
