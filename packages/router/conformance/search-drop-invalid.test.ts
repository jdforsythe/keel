// @vitest-environment happy-dom
// Spec: k.router, clause "?tab=bogus&x=1 on orders.show yields search {}." Also Matching: failing keys dropped, the rest parsed. Seed 1337.
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED, now, resetObservations, settle, start } from "./fixtures.ts";

describe("k.router search parsing", () => {
  beforeEach(resetObservations);
  it("?tab=bogus&x=1 on orders.show yields search {}", async () => {
    const app = await start("/");
    app.history.external("/orders/7?tab=bogus&x=1");
    await settle();
    expect(now(app.router)).toMatchObject({ id: "orders.show", params: { id: "7" } });
    expect(now(app.router).search).toEqual({});
    expect(now(app.router).pending).toBe(false);
    app.stop();
  });
  it("for any invalid tab value and unknown key, orders.show yields search {}", async () => {
    const app = await start("/");
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,8}$/).filter((v) => v !== "items" && v !== "history"),
        fc.stringMatching(/^[a-z]{1,6}$/).filter((k) => k !== "tab"),
        async (bad, key) => {
          app.history.external(`/orders/7?tab=${bad}&${key}=1`);
          await settle();
          expect(now(app.router)).toMatchObject({ id: "orders.show" });
          expect(now(app.router).search).toEqual({});
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
    app.stop();
  });
  it("search keys that fail to parse are dropped and the rest are parsed", async () => {
    const app = await start("/");
    app.history.external("/orders?page=abc&q=hi&sort=asc&zzz=1");
    await settle();
    expect(now(app.router)).toMatchObject({ id: "orders.list", search: { q: "hi", sort: "asc" } });
    expect(Object.keys(now(app.router).search)).toEqual(expect.not.arrayContaining(["page", "zzz"]));
    app.stop();
  });
});
