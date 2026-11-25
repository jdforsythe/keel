// @vitest-environment happy-dom
// k.test-run Disposal "A `render`, `renderRoute` or `resumeDocument` handle made while a test runs ... is disposed when that test ends, passed or failed ..."
// Spec: k.test-run, clause "A test that `renderRoute`s a page with a `<main>` landmark and fails before `dispose()` leaves no element of it in the document once it ends, and the next test's `renderRoute` of that page passes its render checks."
// Seed: 1337 (n/a: no generated inputs). The first case fails on purpose (`it.fails` passes when its body throws); the cases run in order.
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes, simCtx } from "./test-run-support.ts";

let failedRan = false;

describe("k.test-run: a failed test leaves no page behind", () => {
  it.fails("a test that renderRoutes a page with a main landmark and fails before dispose()", async () => {
    const h = await renderRoute("tr.page", { routes, ctx: simCtx() });
    expect(h.find("tr.main").role).toBe("main");
    failedRan = true;
    expect(1).toBe(2);
  });

  it("a failed test leaves no element of its page in the document once it ends", () => {
    expect(failedRan).toBe(true);
    expect(document.getElementById("tr.main")).toBeNull();
    expect(document.body.children.length).toBe(0);
  });

  it("the next test's renderRoute of that page passes its render checks", async () => {
    expect(failedRan).toBe(true);
    const h = await renderRoute("tr.page", { routes, ctx: simCtx() });
    expect(h.find("tr.main").role).toBe("main");
    h.dispose();
  });
});
