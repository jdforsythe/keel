// @vitest-environment happy-dom
// k.router Client scroll on `replace` and with a hash: a search-only `replace` keeps scroll as a search-only push does;
// a `replace` to another route goes to the top.
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED, now, resetObservations, routes, settle, start } from "../conformance/fixtures.ts";

describe("scroll on replace", () => {
  beforeEach(resetObservations);

  it("a search-only replace keeps the scroll position", async () => {
    const app = await start("/orders", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 0, max: 1000 }), async (y, page) => {
        window.scrollTo(0, y);
        await app.router.navigate(routes.href("orders.list", {}, { page }), { replace: true });
        await settle();
        expect(now(app.router)).toMatchObject({ id: "orders.list", search: { page } });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 10 },
    );
    app.stop();
  });

  it("a replace to another route goes to the top", async () => {
    const app = await start("/", { render: true });
    window.scrollTo(0, 300);
    await app.router.navigate(routes.href("orders.list"), { replace: true });
    await settle();
    expect(window.scrollY).toBe(0);
    app.stop();
  });
});
