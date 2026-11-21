// @vitest-environment happy-dom
// Spec: k.router, clause "After an ok(null) action, each loader in the current chain runs exactly once more; after ok(href), route().id is the target's id." Seed 1337.
import { beforeEach, describe, expect, it } from "vitest";
import { control, count, now, resetObservations, settle, start, submit } from "./fixtures.ts";

describe("k.router actions and revalidation", () => {
  beforeEach(resetObservations);
  it("after an ok(null) action, each loader in the current chain runs exactly once more", async () => {
    const app = await start("/orders/7", { render: true });
    const before = { show: count("loader:orders.show"), shell: count("loader:orders.shell") };
    expect(before).toEqual({ show: 1, shell: 1 });
    control.outcome = "null";
    await submit(app.host);
    await settle();
    expect(count("action:POST")).toBe(1);
    expect(control.lastInput).toEqual({ note: "hello" });
    expect(count("loader:orders.show")).toBe(before.show + 1);
    expect(count("loader:orders.shell")).toBe(before.shell + 1);
    expect(now(app.router)).toMatchObject({ id: "app.ordersShow", pending: false });
    app.stop();
  });
  it("after an ok(href) action, route().id is the target's id", async () => {
    const app = await start("/orders/7", { render: true });
    control.outcome = "href";
    await submit(app.host);
    await settle();
    expect(count("action:POST")).toBe(1);
    expect(now(app.router)).toMatchObject({ id: "app.ordersList", pending: false });
    app.stop();
  });
});
