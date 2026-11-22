// Spec: k.testing Harness (`renderRoute` with `app`) through k.scaffold `route`: a page of a module a `node` deployable
// serves gets a test that renders it from that app; one a `client` deployable serves renders through the router.
import { describe, expect, it } from "vitest";
import { apply } from "./helpers.ts";

const withModule = (adapter: string) =>
  apply("module", { id: "orders" }, apply("project", { name: "shop", adapter, workspace: false }, new Map()));

describe("scaffold route: the page test follows the deployable", () => {
  it("a node deployable's page renders from createApp with app", () => {
    const f = apply("route", { id: "orders.list", path: "/orders" }, withModule("node"));
    const t = f.get("modules/orders/list.route.test.ts") ?? "";
    expect(t).toContain(`const served = topology({ web: { modules: ["orders"], adapter: "node" } });`);
    expect(t).toContain(`renderRoute("orders.list", { routes, params: {}, app, ctx })`);
  });

  it("a client deployable's page renders through the router", () => {
    const f = apply("route", { id: "orders.list", path: "/orders" }, withModule("client"));
    const t = f.get("modules/orders/list.route.test.ts") ?? "";
    expect(t).not.toContain("createApp");
    expect(t).toContain(`renderRoute("orders.list", { routes, params: {} })`);
  });
});
