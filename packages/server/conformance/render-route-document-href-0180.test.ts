// @vitest-environment happy-dom
// Spec: k.testing, clause "With `app`, an action's `ok(href)` leaves `route().id` the target's, `location().entries` 2, and the target's loader run once through `app`."
// Seed: 1337 (fc.assert below). Pending: `renderRoute` has no `app` option yet. See render-route-document-support.ts for the assumed fixture shape.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, appOn, control, reset, routes, simCtx } from "./render-route-document-support.ts";

test("With `app`, an action's `ok(href)` leaves `route().id` the target's, `location().entries` 2, and the target's loader run once through `app`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), async (value) => {
      reset("href");
      const ctx = simCtx();
      const app = await appOn(ctx);
      const opts = { routes, ctx, app };
      const h = await renderRoute("f.page", opts);
      await h.fire("f.amount", { type: "input", value });
      await h.fire("f.save", { type: "click" });
      expect(h.route().id).toBe("f.done");
      expect(h.location().entries).toBe(2);
      expect(control.doneLoads).toBe(1);
      expect(app.requests.filter((r) => r === "GET /done")).toHaveLength(1);
      h.dispose();
    }),
    { seed: SEED, numRuns: 10 },
  );
});
