// Spec: k.scaffold `route` with `api` (k.api): an API manifest entry, a loader, a JSON request test, and no page.
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { apply } from "./helpers.ts";

const base = (workspace: boolean) => {
  const f = apply("project", { name: "shop", adapter: "node", workspace }, new Map());
  return apply("module", { id: "orders" }, f);
};

describe("scaffold route --api", () => {
  it("writes an api entry and a loader, and no component file", () => {
    const f = apply("route", { id: "orders.list", path: "/api/orders/:id", api: true }, base(false));
    const routes = f.get("modules/orders/routes.ts") ?? "";
    expect(routes).toContain(`"orders.list": {\n    api: true,\n    path: "/api/orders/:id",`);
    expect(routes).toContain("loader: loadList,");
    expect(routes).not.toContain("component");
    expect(f.has("modules/orders/loadList.server.ts")).toBe(true);
    expect([...f.keys()].filter((p) => p.endsWith(".tsx"))).toEqual([]);
  });

  it("tests a JSON request, not renderRoute", () => {
    const f = apply("route", { id: "orders.list", path: "/api/orders/:id", api: true }, base(false));
    const t = f.get("modules/orders/list.route.test.ts") ?? "";
    expect(t).toContain(`"http://localhost/api/orders/1"`);
    expect(t).toContain(`from "../../topology.ts"`);
    expect(t).not.toContain("renderRoute");
    const w = apply("route", { id: "orders.list", path: "/api/orders", api: true }, base(true));
    expect(w.get("test/orders.list.route.test.ts")).toContain(`from "../topology.ts"`);
  });

  it("refuses a page file and a repeated id", () => {
    const f = base(false);
    expect(scaffold("route", { id: "orders.a", path: "/a", api: true, file: "modules/orders/A.tsx" }, f).ok).toBe(
      false,
    );
    const g = apply("route", { id: "orders.a", path: "/a", api: true }, f);
    const again = scaffold("route", { id: "orders.a", path: "/b", api: true }, g);
    expect(again.ok ? "" : again.error.message).toContain("E1351");
  });
});
