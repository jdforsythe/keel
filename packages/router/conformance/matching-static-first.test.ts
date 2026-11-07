// @vitest-environment happy-dom
// Spec: k.router Matching prose (not a Conformance sentence): "a static segment beats :param". Seed 1337.
import { beforeEach, describe, expect, it } from "vitest";
import { now, resetObservations, routes, settle, start } from "./fixtures.ts";

describe("k.router matching", () => {
  beforeEach(resetObservations);
  it("a static segment beats :param", async () => {
    const app = await start("/");
    await app.router.navigate(routes.href("orders.new"));
    await settle();
    expect(now(app.router)).toMatchObject({ id: "orders.new" });
    app.history.external("/orders/bare");
    await settle();
    expect(now(app.router)).toMatchObject({ id: "orders.bare" });
    app.stop();
  });
});
