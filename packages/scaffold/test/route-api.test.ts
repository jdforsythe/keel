// Spec: k.scaffold `route` with `api` (k.api): an API contract entry and its binding, a handler, a JSON request test, and no page.
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
    const contract = f.get("modules/orders/orders.contract.ts") ?? "";
    expect(contract).toContain(`"orders.list": {\n    method: "GET",\n    path: "/api/orders/:id",`);
    expect(contract).toContain("output: s.object({}),");
    const routes = f.get("modules/orders/routes.ts") ?? "";
    expect(routes).toContain(`"orders.list": {\n    loader: loadList,\n  },`);
    expect(routes).not.toContain("component");
    expect(f.get("modules/orders/loadList.server.ts")).toContain(`loader(orders, "orders.list", {}, `);
    expect(f.has("modules/orders/loadList.server.ts")).toBe(true);
    expect([...f.keys()].filter((p) => p.startsWith("modules/orders/") && p.endsWith(".tsx"))).toEqual([]);
  });

  it("an API write is an entry with its method, bound to an action named after the verb", () => {
    const f = apply("route", { id: "orders.add", path: "/api/orders", api: true, method: "POST" }, base(false));
    expect(f.get("modules/orders/orders.contract.ts")).toContain(`method: "POST",`);
    expect(f.get("modules/orders/routes.ts")).toContain(`"orders.add": {\n    action: postAdd,\n  },`);
    expect(f.get("modules/orders/postAdd.server.ts")).toContain(`action(orders, "orders.add", {}, `);
    expect(f.get("modules/orders/add.route.test.ts")).toContain(`method: "POST"`);
    const g = apply("route", { id: "orders.list", path: "/api/orders", api: true }, f);
    expect(g.get("modules/orders/routes.ts")).toContain("loader: loadList,");
  });

  it("refuses a method without api, a dotted API id and a repeated method at one path", () => {
    const f = base(false);
    const msg = (input: Record<string, unknown>, files = f): string => {
      const r = scaffold("route", input, files);
      return r.ok ? "" : r.error.message;
    };
    expect(msg({ id: "orders.a", path: "/a", method: "POST" })).toContain("E1052");
    expect(msg({ id: "orders.a.b", path: "/a", api: true })).toContain("E1352");
    const g = apply("route", { id: "orders.add", path: "/api/orders", api: true, method: "POST" }, f);
    expect(msg({ id: "orders.other", path: "/api/orders", api: true, method: "POST" }, g)).toContain("E1351");
    expect(scaffold("route", { id: "orders.list", path: "/api/orders", api: true }, g).ok).toBe(true);
  });

  it("tests a JSON request, not renderRoute", () => {
    const f = apply("route", { id: "orders.list", path: "/api/orders/:id", api: true }, base(false));
    const t = f.get("modules/orders/list.route.test.ts") ?? "";
    expect(t).toContain(`"http://localhost/api/orders/1"`);
    // The module alone in a node deployable, whatever the project's topology serves it from.
    expect(t).toContain(`topology({ api: { modules: ["orders"], adapter: "node" } })`);
    expect(t).not.toContain("topology.ts");
    expect(t).not.toContain("renderRoute");
    const w = apply("route", { id: "orders.list", path: "/api/orders", api: true }, base(true));
    expect(w.get("test/orders.list.route.test.ts")).toContain(`from "../modules/orders/routes.ts"`);
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
