// @vitest-environment happy-dom
// k.router Matching prose (not a Conformance sentence): "static beats `:param`". Seed 1337.
import { beforeEach, describe, expect, it } from "vitest";
import { appContract, now, resetObservations, settle, start } from "./fixtures.ts";

describe("k.router matching", () => {
  beforeEach(resetObservations);
  it("a static segment beats :param", async () => {
    const app = await start("/");
    await app.router.navigate(appContract.href("app.ordersNew"));
    await settle();
    expect(now(app.router)).toMatchObject({ id: "app.ordersNew" });
    app.history.external("/orders/bare");
    await settle();
    expect(now(app.router)).toMatchObject({ id: "app.ordersBare" });
    app.stop();
  });
});
