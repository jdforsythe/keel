// Example tests that pin the rejection paths and file effects of `route` and `rename` (backlog 0097).
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { type Files, apply } from "./helpers.ts";

type Rej = { code: string; path: string; message: string };

function rej(op: "route" | "rename", input: Record<string, unknown>, files: Files): Rej {
  const r = scaffold(op, input, files);
  if (r.ok) throw new Error(`${op} unexpectedly succeeded`);
  const d = r.error.data;
  return { code: String(d.code), path: String(d.path), message: String(d.message) };
}

function base(): Files {
  let f: Files = apply("project", { name: "shop" }, new Map());
  f = apply("module", { id: "orders" }, f);
  f = apply("module", { id: "users" }, f);
  f = apply("store", { id: "orders.cart" }, f);
  f = apply("route", { id: "orders.show", path: "/orders/:id" }, f);
  f = apply("component", { id: "orders/Panel" }, f);
  return f;
}

describe("route rejections", () => {
  const f = base();
  it("generated targets", () => {
    expect(rej("route", { id: ".keel.x", path: "/x" }, f).code).toMatch(/^E1/);
    expect(rej("route", { id: "orders.x", path: "/x", file: ".keel/P.tsx" }, f)).toEqual({
      code: "E1005",
      path: ".keel/P.tsx",
      message: ".keel/P.tsx is a generated location",
    });
  });
  it("bad id, unknown module, bad path, bad page file", () => {
    expect(rej("route", { id: "Orders.x", path: "/x" }, f)).toEqual({
      code: "E1352",
      path: "Orders.x",
      message: "route id Orders.x must be dotted lowerCamel segments prefixed by a module",
    });
    expect(rej("route", { id: "ghost.x", path: "/x" }, f)).toEqual({
      code: "E1352",
      path: "ghost.x",
      message: "ghost is not a module of this project",
    });
    for (const p of ["x", "/X", "/a//b", "/a/", "/-a", "/a b"]) {
      expect(rej("route", { id: "orders.fresh", path: p }, f)).toEqual({
        code: "E1352",
        path: "modules/orders/routes.ts",
        message: `route path ${p} must be /-separated lowercase segments or :params`,
      });
    }
    for (const file of [
      "modules/users/P.tsx",
      "modules/orders/p.tsx",
      "modules/orders/P.ts",
      "modules/orders/Pa-b.tsx",
    ]) {
      expect(rej("route", { id: "orders.fresh", path: "/fresh", file }, f)).toEqual({
        code: "E1352",
        path: file,
        message: "page file must be modules/orders/<Name>.tsx with a PascalCase name",
      });
    }
  });
  it("duplicates by id, by path pattern, and by existing files", () => {
    expect(rej("route", { id: "orders.show", path: "/other" }, f)).toEqual({
      code: "E1351",
      path: "modules/orders/orders.contract.ts",
      message: "route orders.show already exists",
    });
    expect(rej("route", { id: "orders.fresh", path: "/orders/:other" }, f)).toEqual({
      code: "E1351",
      path: "modules/orders/orders.contract.ts",
      message: "path /orders/:other is already routed by orders.show",
    });
    const g = new Map(f).set("modules/orders/loadFresh.server.ts", "");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, g)).toEqual({
      code: "E1351",
      path: "modules/orders/loadFresh.server.ts",
      message: "modules/orders/loadFresh.server.ts already exists",
    });
    const h = new Map(f).set("modules/orders/fresh.route.test.ts", "").set("vitest.config.ts", "");
    h.delete("test/orders.fresh.route.test.ts");
    expect(scaffold("route", { id: "orders.fresh", path: "/fresh" }, h).ok).toBe(true);
    const i = new Map(f).set("test/orders.fresh.route.test.ts", "").set("vitest.config.ts", "");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, i).path).toBe("test/orders.fresh.route.test.ts");
    const j = new Map(f).set("modules/orders/fresh.route.test.ts", "");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, j).path).toBe("modules/orders/fresh.route.test.ts");
    const k = new Map(f).set("modules/users/FreshPage.tsx", "");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, k).path).toBe("modules/users/FreshPage.tsx");
  });
  it("a routes.ts without manifest(contract, {...}), a contract file without contract(id, {...})", () => {
    const g = new Map(f).set("modules/orders/routes.ts", "export const x = 1\n");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, g)).toEqual({
      code: "E1052",
      path: "modules/orders/routes.ts",
      message: "modules/orders/routes.ts has no manifest(orders, {...}) to add the route to",
    });
    const c = new Map(f).set("modules/orders/orders.contract.ts", "export const x = 1\n");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, c)).toEqual({
      code: "E1052",
      path: "modules/orders/orders.contract.ts",
      message: 'modules/orders/orders.contract.ts has no contract("orders", {...}) to add the route to',
    });
    const h = new Map(f);
    h.delete("modules/orders/routes.ts");
    expect(rej("route", { id: "orders.fresh", path: "/fresh" }, h).code).toBe("E1052");
  });
});

describe("route effects", () => {
  it("adds the manifest entry, loader, page and test (the root path is the project's `app.home`)", () => {
    const f = base();
    expect(rej("route", { id: "orders.list", path: "/" }, f).code).toBe("E1351");
    const out = apply("route", { id: "orders.list", path: "/list" }, f);
    expect([...out.keys()].filter((p) => !f.has(p)).sort()).toEqual([
      "modules/orders/ListPage.tsx",
      "modules/orders/list.route.test.ts",
      "modules/orders/loadList.server.ts",
    ]);
    const routes = out.get("modules/orders/routes.ts") ?? "";
    expect(routes).toContain('import ListPage from "./ListPage.tsx";');
    expect(routes).toContain('import { loadList } from "./loadList.server.ts";');
    expect(routes).toContain("orders.list");
    expect(routes.indexOf("orders.show")).toBeLessThan(routes.indexOf("orders.list"));
    const contract = out.get("modules/orders/orders.contract.ts") ?? "";
    expect(contract.indexOf("orders.show")).toBeLessThan(contract.indexOf("orders.list"));
    expect(contract.match(/import \{ s \} from "@keel\/schema"/g)?.length ?? 0).toBe(1);
  });
  it("imports s once when a param route is added and s is not yet imported", () => {
    let f: Files = apply("project", { name: "shop" }, new Map());
    f = apply("module", { id: "orders" }, f);
    const file = "modules/orders/orders.contract.ts";
    const bare = (head: string): Files =>
      new Map(f).set(
        file,
        `${head}import { contract } from '@keel/router/contract'\nexport const orders = contract('orders', {})\n`,
      );
    const out = apply("route", { id: "orders.show", path: "/orders/:id" }, bare(""));
    expect(out.get(file)).toContain('import { s } from "@keel/schema";');
    const plain = apply("route", { id: "orders.list", path: "/orders" }, bare(""));
    expect(plain.get(file)).not.toContain("@keel/schema");
    const has = apply(
      "route",
      { id: "orders.show", path: "/orders/:id" },
      bare("import { s, t } from '@keel/schema'\n"),
    );
    expect(has.get(file)?.match(/@keel\/schema/g)?.length).toBe(1);
    const both = apply(
      "route",
      { id: "orders.show", path: "/orders/:id" },
      bare("import { sx } from '@keel/schema'\n"),
    );
    expect(both.get(file)).toContain('import { s } from "@keel/schema";');
  });
  it("puts the test under test/ when the project has a vitest config, with a custom page file", () => {
    const f = new Map(base()).set("vitest.config.ts", "export default {}\n");
    const out = apply("route", { id: "orders.edit", path: "/orders/:id/edit", file: "modules/orders/Editor.tsx" }, f);
    expect(out.has("test/orders.edit.route.test.ts")).toBe(true);
    expect(out.has("modules/orders/Editor.tsx")).toBe(true);
    expect(out.get("test/orders.edit.route.test.ts")).toContain("../modules/orders/routes.ts");
    expect(out.get("modules/orders/routes.ts")).toContain('import Editor from "./Editor.tsx";');
  });
});

describe("rename rejections", () => {
  const f = base();
  it("same name, bad names, missing declarations, collisions", () => {
    expect(rej("rename", { kind: "component", from: "Panel", to: "Panel" }, f)).toEqual({
      code: "E1351",
      path: "Panel",
      message: "Panel already exists",
    });
    expect(rej("rename", { kind: "component", from: "Panel", to: "panel" }, f)).toEqual({
      code: "E1352",
      path: "panel",
      message: "component name panel must be PascalCase",
    });
    expect(rej("rename", { kind: "schema", from: "Ghost", to: "panel" }, f).message).toBe(
      "schema name panel must be PascalCase",
    );
    expect(rej("rename", { kind: "component", from: "Ghost", to: "Other" }, f)).toEqual({
      code: "E1052",
      path: "Ghost",
      message: "no component named Ghost",
    });
    expect(rej("rename", { kind: "schema", from: "Ghost", to: "Other" }, f).message).toBe("no schema named Ghost");
    const g = new Map(f).set("modules/orders/Other.tsx", "export default function Other() { return null }\n");
    expect(rej("rename", { kind: "component", from: "Panel", to: "Other" }, g)).toEqual({
      code: "E1351",
      path: "modules/orders/Other.tsx",
      message: "component Other already exists",
    });
    const h = new Map(f).set(".keel/Panel.tsx", "export default function Panel() { return null }\n");
    h.delete("modules/orders/Panel.tsx");
    expect(rej("rename", { kind: "component", from: "Panel", to: "Other" }, h)).toEqual({
      code: "E1005",
      path: ".keel/Panel.tsx",
      message: "Panel is declared in generated .keel/Panel.tsx; regenerate instead",
    });
  });
  it("store errors", () => {
    expect(rej("rename", { kind: "store", from: "cart", to: "orders.basket" }, f)).toEqual({
      code: "E1052",
      path: "cart",
      message: "cart is not a store id",
    });
    expect(rej("rename", { kind: "store", from: "orders.cart", to: "Basket" }, f)).toEqual({
      code: "E1352",
      path: "Basket",
      message: "store id Basket must be <module>.<name>, both lowerCamel",
    });
    expect(rej("rename", { kind: "store", from: "orders.cart", to: "users.cart" }, f)).toEqual({
      code: "E1352",
      path: "users.cart",
      message: "rename keeps the module (orders); use codemod move",
    });
    expect(rej("rename", { kind: "store", from: "orders.nope", to: "orders.basket" }, f)).toEqual({
      code: "E1052",
      path: "orders.nope",
      message: "no store orders.nope",
    });
    const g = new Map(f).set("modules/orders/basket.store.ts", "export const basket = 1\n");
    expect(rej("rename", { kind: "store", from: "orders.cart", to: "orders.basket" }, g)).toEqual({
      code: "E1351",
      path: "modules/orders/basket.store.ts",
      message: "store orders.basket exists",
    });
  });
  it("route errors", () => {
    expect(rej("rename", { kind: "route", from: "show", to: "orders.view" }, f)).toEqual({
      code: "E1052",
      path: "show",
      message: "show is not a route id",
    });
    expect(rej("rename", { kind: "route", from: "orders.show", to: "View" }, f)).toEqual({
      code: "E1352",
      path: "View",
      message: "route id View must be dotted lowerCamel segments prefixed by a module",
    });
    expect(rej("rename", { kind: "route", from: "orders.show", to: "users.show" }, f)).toEqual({
      code: "E1352",
      path: "users.show",
      message: "rename keeps the module (orders); use codemod move",
    });
    expect(rej("rename", { kind: "route", from: "orders.nope", to: "orders.view" }, f)).toEqual({
      code: "E1052",
      path: "orders.nope",
      message: "no route orders.nope",
    });
    const g = apply("route", { id: "orders.view", path: "/view" }, f);
    expect(rej("rename", { kind: "route", from: "orders.show", to: "orders.view" }, g)).toEqual({
      code: "E1351",
      path: "modules/orders/orders.contract.ts",
      message: "route orders.view already exists",
    });
  });
  it("module errors", () => {
    expect(rej("rename", { kind: "module", from: "orders", to: "Bad" }, f).code).toBe("E1352");
    expect(rej("rename", { kind: "module", from: "ghost", to: "other" }, f)).toEqual({
      code: "E1052",
      path: "ghost",
      message: "no module ghost",
    });
    expect(rej("rename", { kind: "module", from: "orders", to: "users" }, f)).toEqual({
      code: "E1351",
      path: "modules/users",
      message: "module users already exists",
    });
  });
});

describe("rename effects", () => {
  it("component: moves the file and test files, rewrites imports in other files", () => {
    let f = base();
    f.set("test/Panel.test.ts", "import Panel from '../modules/orders/Panel.tsx'\nexport const x = Panel\n");
    f.set("modules/orders/Panel.css.ts", "export const c = 1\n");
    f.set("modules/users/Panel.tsx", "export const different = 1\n");
    f.set("modules/orders/PanelX.tsx", "export const prefixOnly = 1\n");
    f.set("modules/orders/use.ts", "import Panel from './Panel.tsx'\nexport const p = Panel\n");
    f = apply("rename", { kind: "component", from: "Panel", to: "Board" }, f);
    expect(f.has("modules/orders/Board.tsx")).toBe(true);
    expect(f.has("modules/orders/Panel.tsx")).toBe(false);
    expect(f.has("modules/orders/Board.css.ts")).toBe(true);
    expect(f.has("test/Board.test.ts")).toBe(true);
    expect(f.has("test/Panel.test.ts")).toBe(false);
    expect(f.has("modules/orders/PanelX.tsx")).toBe(true);
    expect(f.has("modules/users/Panel.tsx")).toBe(true);
    expect(f.get("modules/orders/use.ts")).toBe("import Board from './Board.tsx'\nexport const p = Board\n");
    expect(f.get("test/Board.test.ts")).toBe(
      "import Board from '../modules/orders/Board.tsx'\nexport const x = Board\n",
    );
  });
  it("store: renames store files, State files, test files and ids", () => {
    let f = base();
    f.set("modules/orders/CartState.ts", "export type CartState = { n: number }\n");
    f.set("test/orders.cart.store.test.ts", "import { cart } from '../modules/orders/cart.store.ts'\nvoid cart\n");
    f.set("test/users.cart.store.test.ts", "export const keep = 1\n");
    f = apply("rename", { kind: "store", from: "orders.cart", to: "orders.basket" }, f);
    expect(f.has("modules/orders/basket.store.ts")).toBe(true);
    expect(f.has("modules/orders/cart.store.ts")).toBe(false);
    expect(f.has("modules/orders/BasketState.ts")).toBe(true);
    expect(f.get("modules/orders/BasketState.ts")).toBe("export type BasketState = { n: number }\n");
    expect(f.has("test/orders.basket.store.test.ts")).toBe(true);
    expect(f.has("test/users.cart.store.test.ts")).toBe(true);
    expect(f.get("test/orders.basket.store.test.ts")).toBe(
      "import { basket } from '../modules/orders/basket.store.ts'\nvoid basket\n",
    );
  });
  it("route: renames loader, page, route test, test dir file, and the path segment", () => {
    let f = base();
    f.set("vitest.config.ts", "export default {}\n");
    f.set("test/orders.show.route.test.ts", "export const t = 'orders.show'\n");
    f.set("test/users.show.route.test.ts", "export const keep = 1\n");
    f = apply("rename", { kind: "route", from: "orders.show", to: "orders.view" }, f);
    expect(f.has("modules/orders/loadView.server.ts")).toBe(true);
    expect(f.has("modules/orders/loadShow.server.ts")).toBe(false);
    expect(f.has("modules/orders/ViewPage.tsx")).toBe(true);
    expect(f.has("modules/orders/ShowPage.tsx")).toBe(false);
    expect(f.has("test/orders.view.route.test.ts")).toBe(true);
    expect(f.has("test/users.show.route.test.ts")).toBe(true);
    expect(f.get("test/orders.view.route.test.ts")).toBe("export const t = 'orders.view'\n");
    const routes = f.get("modules/orders/routes.ts") ?? "";
    expect(routes).toContain('"orders.view"');
    expect(routes).not.toContain("orders.show");
    expect(routes).toContain("loadView");
    expect(routes).toContain("ViewPage");
    const contract = f.get("modules/orders/orders.contract.ts") ?? "";
    expect(contract).toContain('"orders.view"');
    expect(contract).not.toContain("orders.show");
    expect(contract).toContain("/orders/:id");
    expect(f.get("modules/orders/loadView.server.ts")).toContain('loader(orders, "orders.view"');
  });
  it("module: moves files, rewrites ids, deps and topology, and test files", () => {
    let f = base();
    f = apply("module", { id: "ship" }, f);
    f.set("modules/ship/module.ts", f.get("modules/ship/module.ts")?.replace("deps: []", "deps: ['orders']") ?? "");
    f.set("test/orders.misc.test.ts", "export const a = 'orders.cart'\n");
    const before = f.get("modules/ship/module.ts") ?? "";
    expect(before).toContain("'orders'");
    f = apply("rename", { kind: "module", from: "orders", to: "sales" }, f);
    expect(f.has("modules/sales/module.ts")).toBe(true);
    expect(f.has("modules/orders/module.ts")).toBe(false);
    expect(f.has("test/sales.misc.test.ts")).toBe(true);
    expect(f.get("modules/ship/module.ts")).toContain("'sales'");
    expect(f.get("modules/sales/module.ts")).toContain('id: "sales"');
    expect(f.get("modules/sales/routes.ts")).toContain("sales.show");
    expect(f.get("modules/sales/routes.ts")).toContain("manifest(sales, ");
    expect(f.get("modules/sales/routes.ts")).toContain('from "./sales.contract.ts"');
    expect(f.get("modules/sales/sales.contract.ts")).toContain('export const sales = contract("sales", {');
    expect(f.get("modules/sales/sales.contract.ts")).toContain('"sales.show"');
    expect(f.has("modules/orders/orders.contract.ts")).toBe(false);
    expect(f.get("test/sales.misc.test.ts")).toBe("export const a = 'sales.cart'\n");
    expect(f.get("turbo.json")).toContain("sales");
    expect(f.get("turbo.json")).not.toContain("orders");
  });
});
