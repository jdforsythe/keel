// @vitest-environment happy-dom
// Spec: k.router, clause "A path whose params fail the schema yields 404 and calls no loader." Seed 1337.
// 404 is observed as the matched route's errorElement receiving code keel.notFound (k.router Matching, k.server).
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED, count, resetObservations, settle, start, total } from "./fixtures.ts";

describe("k.router params failure", () => {
  beforeEach(resetObservations);
  it("a path whose params fail the schema yields 404 and calls no loader", async () => {
    const app = await start("/", { render: true });
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{1,6}$/), async (bad, id) => {
        resetObservations();
        app.history.external(`/orders/${id}/lines/${bad}`);
        await settle();
        const shown = app.host.querySelector("[data-error]");
        expect(shown?.getAttribute("data-code")).toBe("keel.notFound");
        expect(total("loader:")).toBe(0);
        expect(count("render:orders.line")).toBe(0);
      }),
      { seed: SEED, numRuns: 50 },
    );
    app.stop();
  });
});
