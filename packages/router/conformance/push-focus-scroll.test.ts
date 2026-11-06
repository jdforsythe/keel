// @vitest-environment happy-dom
// Spec: k.router, clause "After a push navigation, document.activeElement is main and the scroll position is 0; back restores the previous entry's scroll position." Seed 1337.
// Relies on happy-dom window.scrollTo updating window.scrollY.
import { href } from "@keel/router";
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED, now, resetObservations, settle, start, submit } from "./fixtures.ts";

describe("k.router scroll and focus", () => {
  beforeEach(resetObservations);
  it("after a push navigation, document.activeElement is main and the scroll position is 0", async () => {
    const app = await start("/", { render: true });
    window.scrollTo(0, 300);
    await app.router.navigate(href("orders.list"));
    await settle();
    const main = app.host.querySelector("main");
    expect(main).not.toBeNull();
    expect(document.activeElement).toBe(main);
    expect(main?.getAttribute("tabindex")).toBe("-1");
    expect(window.scrollY).toBe(0);
    app.stop();
  });
  it("back restores the previous entry's scroll position", async () => {
    const app = await start("/", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), async (y) => {
        await app.router.navigate(href("orders.list"));
        await settle();
        window.scrollTo(0, y);
        await app.router.navigate(href("orders.new"));
        await settle();
        expect(window.scrollY).toBe(0);
        app.history.back();
        await settle();
        expect(now(app.router)).toMatchObject({ id: "orders.list" });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 25 },
    );
    app.stop();
  });
  it("revalidation changes neither scroll nor focus", async () => {
    const app = await start("/orders/7", { render: true });
    const input = app.host.querySelector("#note");
    if (!(input instanceof HTMLElement)) throw new Error("fixture: note input missing");
    input.focus();
    window.scrollTo(0, 77);
    await submit(app.host);
    expect(document.activeElement).toBe(input);
    expect(window.scrollY).toBe(77);
    app.stop();
  });
});
