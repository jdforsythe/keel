// `toTest`: the test file `keel session to-test` writes for a session. Its header, its imports (stores, route
// tables, the contracts its navigations need, each under a name that clashes with nothing), the base render, one line
// per input with the clock advanced only where time moves, and the closing expectation.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { parseTs } from "../../src/internal/parseTs.ts";
import { toTest } from "../../src/toTest.ts";

const session = (over: Record<string, unknown> = {}): Session => {
  const given = {
    v: 1,
    id: "s1",
    seed: 1337,
    deterministic: true,
    at: 0,
    route: { id: "cart.show", params: {}, search: {} },
    state: {},
    events: [],
    error: null,
    fingerprint: "7f3a9c01d2e4",
    ...over,
  };
  const parsed = Session.parse(Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)));
  if (!parsed.ok) throw new Error(`the fixture session parses: ${parsed.error.message}`);
  return parsed.value;
};
const cartRoutes = { module: "cart", from: "../routes.ts", contract: "../cart.contract.ts" };
const one = { navs: [], stores: [], routes: [cartRoutes] };
const lines = (source: string): string[] => source.split("\n");
const body = (source: string): string[] => {
  const all = lines(source);
  return all.slice(all.findIndex((l) => l.startsWith("test(")) + 1, all.lastIndexOf("});"));
};

describe("toTest: the whole file", () => {
  test("the smallest session: header, imports, one test that renders the base and expects no error", () => {
    expect(toTest(session(), one)).toBe(
      [
        "// Session: 7f3a9c01d2e4, seed 1337",
        'import { createCtx } from "@keel/ctx";',
        'import { record } from "@keel/std-sessions/record";',
        'import { renderRoute } from "@keel/testing";',
        'import { expect, test } from "vitest";',
        'import { routes } from "../routes.ts";',
        "",
        'test("session 7f3a9c01d2e4", async () => {',
        '  const ctx = createCtx({ mode: "sim", seed: 1337 });',
        "  const rec = record(ctx);",
        '  const h = await renderRoute("cart.show", { routes, params: {}, search: {}, state: [], ctx });',
        "  expect(rec.errors()).toEqual([]);",
        "  h.dispose();",
        "});",
        "",
      ].join("\n"),
    );
  });

  test("a session with stores, inputs, a navigation and two serving modules", () => {
    const s = session({
      at: 100,
      route: { id: "cart.show", params: { cartId: "c1" }, search: { tab: "all" } },
      state: { "cart.cart": { items: ["a"] }, "orders.list": { n: 1 }, "other.unlisted": { x: 1 } },
      events: [
        { at: 100, kind: "fire", id: "cart.add", event: { type: "click" } },
        { at: 100, kind: "tx", store: "cart.cart", name: "cart.add", payload: {} },
        { at: 250, kind: "fire", id: "cart.card", event: { type: "input", value: 'a "quoted" value' } },
        { at: 250, kind: "resource", id: "cart.items", state: "ready" },
        { at: 300, kind: "nav", href: "/orders/o1?page=2" },
        { at: 300, kind: "net", online: false },
        { at: 300, kind: "error", route: "orders.show", error: { code: "x.y", message: "m", data: null } },
        { at: 450, kind: "net", online: true },
      ],
    });
    const source = toTest(s, {
      navs: [{ index: 4, id: "orders.show", params: { orderId: "o1" }, search: { page: 2 } }],
      stores: [
        { id: "cart.cart", name: "cart", from: "../cart.ts" },
        { id: "orders.list", name: "list", from: "../../orders/list.ts" },
      ],
      routes: [
        cartRoutes,
        { module: "orders", from: "../../orders/routes.ts", contract: "../../orders/orders.contract.ts" },
      ],
    });
    expect(source).toBe(
      [
        "// Session: 7f3a9c01d2e4, seed 1337",
        'import { createCtx } from "@keel/ctx";',
        'import { routeTable } from "@keel/router";',
        'import { record } from "@keel/std-sessions/record";',
        'import { renderRoute } from "@keel/testing";',
        'import { expect, test } from "vitest";',
        'import { cart } from "../cart.ts";',
        'import { list } from "../../orders/list.ts";',
        'import { routes as cartRoutes } from "../routes.ts";',
        'import { routes as ordersRoutes } from "../../orders/routes.ts";',
        'import { orders } from "../../orders/orders.contract.ts";',
        "",
        "const routes = routeTable(cartRoutes, ordersRoutes);",
        "",
        'test("session 7f3a9c01d2e4", async () => {',
        '  const ctx = createCtx({ mode: "sim", seed: 1337 });',
        "  ctx.clock.advance(100);",
        "  const rec = record(ctx);",
        '  const h = await renderRoute("cart.show", { routes, params: {"cartId":"c1"}, search: {"tab":"all"}, state: [[cart, {"items":["a"]}], [list, {"n":1}]], ctx });',
        '  await h.fire("cart.add", {"type":"click"});',
        "  ctx.clock.advance(150);",
        '  await h.fire("cart.card", {"type":"input","value":"a \\"quoted\\" value"});',
        "  ctx.clock.advance(50);",
        '  await h.navigate(orders.href("orders.show", {"orderId":"o1"}, {"page":2}));',
        "  ctx.net.setOnline(false);",
        "  ctx.clock.advance(150);",
        "  ctx.net.setOnline(true);",
        "  expect(rec.errors()).toEqual([]);",
        "  h.dispose();",
        "});",
        "",
      ].join("\n"),
    );
    expect(parseTs("modules/cart/test/session.test.ts", source)).toBeDefined();
  });
});

describe("toTest: seed and clock", () => {
  test("a session with no seed runs on seed 0, in the header and in the ctx", () => {
    const source = toTest(session({ seed: undefined, deterministic: false }), one);
    expect(lines(source)[0]).toBe("// Session: 7f3a9c01d2e4, seed 0");
    expect(body(source)[0]).toBe('  const ctx = createCtx({ mode: "sim", seed: 0 });');
    expect(body(toTest(session({ seed: 0 }), one))[0]).toBe('  const ctx = createCtx({ mode: "sim", seed: 0 });');
  });

  test("the clock is advanced by the difference, only when time moves forward, starting from the session's `at`", () => {
    const fire = (at: number, id: string) => ({ at, kind: "fire", id, event: { type: "click" } });
    const source = toTest(
      session({ at: 40, events: [fire(40, "a"), fire(40, "b"), fire(100, "c"), fire(90, "d"), fire(101, "e")] }),
      one,
    );
    expect(body(source)).toEqual([
      '  const ctx = createCtx({ mode: "sim", seed: 1337 });',
      "  ctx.clock.advance(40);",
      "  const rec = record(ctx);",
      '  const h = await renderRoute("cart.show", { routes, params: {}, search: {}, state: [], ctx });',
      '  await h.fire("a", {"type":"click"});',
      '  await h.fire("b", {"type":"click"});',
      "  ctx.clock.advance(60);",
      '  await h.fire("c", {"type":"click"});',
      '  await h.fire("d", {"type":"click"});',
      "  ctx.clock.advance(1);",
      '  await h.fire("e", {"type":"click"});',
      "  expect(rec.errors()).toEqual([]);",
      "  h.dispose();",
    ]);
  });

  test("an observation's time does not move the clock: only inputs do", () => {
    const source = toTest(
      session({
        events: [
          { at: 500, kind: "tx", store: "s", name: "s.t", payload: null },
          { at: 600, kind: "resource", id: "r", state: "ready" },
          { at: 700, kind: "error", route: "cart.show", error: { code: "c", message: "m", data: null } },
          { at: 5, kind: "fire", id: "a", event: { type: "click" } },
        ],
      }),
      one,
    );
    expect(body(source).slice(3, -2)).toEqual(["  ctx.clock.advance(5);", '  await h.fire("a", {"type":"click"});']);
  });
});

describe("toTest: stores", () => {
  test("a listed store is imported, and seeded when the session holds its state", () => {
    const source = toTest(session({ state: { "cart.cart": { items: [] } } }), {
      ...one,
      stores: [
        { id: "cart.cart", name: "cart", from: "../cart.ts" },
        { id: "cart.prefs", name: "prefs", from: "../prefs.ts" },
      ],
    });
    expect(lines(source)).toContain('import { cart } from "../cart.ts";');
    expect(lines(source)).toContain('import { prefs } from "../prefs.ts";');
    expect(source).toContain('state: [[cart, {"items":[]}]], ctx });');
  });

  test("a store whose name is taken is imported under another: <name>Store, then <name>Store2, ...", () => {
    const source = toTest(
      session({
        state: { "a.routes": 1, "b.routes": 2, "c.routes": 3, "a.ctx": 4, "a.h": 5, "a.same": 6, "b.same": 7 },
      }),
      {
        ...one,
        stores: [
          { id: "a.routes", name: "routes", from: "../a.ts" },
          { id: "b.routes", name: "routes", from: "../b.ts" },
          { id: "c.routes", name: "routes", from: "../c.ts" },
          { id: "a.ctx", name: "ctx", from: "../ctx.ts" },
          { id: "a.h", name: "h", from: "../h.ts" },
          { id: "a.same", name: "same", from: "../same-a.ts" },
          { id: "b.same", name: "same", from: "../same-b.ts" },
        ],
      },
    );
    expect(lines(source).filter((l) => l.startsWith("import {") && l.includes("../"))).toEqual([
      'import { routes as routesStore } from "../a.ts";',
      'import { routes as routesStore2 } from "../b.ts";',
      'import { routes as routesStore3 } from "../c.ts";',
      'import { ctx as ctxStore } from "../ctx.ts";',
      'import { h as hStore } from "../h.ts";',
      'import { same } from "../same-a.ts";',
      'import { same as sameStore } from "../same-b.ts";',
      'import { routes } from "../routes.ts";',
    ]);
    expect(source).toContain(
      "state: [[routesStore, 1], [routesStore2, 2], [routesStore3, 3], [ctxStore, 4], [hStore, 5], [same, 6], [sameStore, 7]], ctx });",
    );
  });

  test("every name the test itself uses is reserved", () => {
    for (const name of [
      "createCtx",
      "record",
      "renderRoute",
      "expect",
      "test",
      "routeTable",
      "routes",
      "ctx",
      "rec",
      "h",
    ]) {
      const source = toTest(session(), { ...one, stores: [{ id: `m.${name}`, name, from: "../m.ts" }] });
      expect(lines(source), name).toContain(`import { ${name} as ${name}Store } from "../m.ts";`);
    }
    expect(lines(toTest(session(), { ...one, stores: [{ id: "m.free", name: "free", from: "../m.ts" }] }))).toContain(
      'import { free } from "../m.ts";',
    );
  });
});

describe("toTest: route tables and navigations", () => {
  const orders = { module: "orders", from: "../../orders/routes.ts", contract: "../../orders/orders.contract.ts" };
  const nav = (at: number, href: string) => ({ at, kind: "nav", href });

  test("one serving module imports `routes`; several are joined with routeTable under <module>Routes names", () => {
    expect(toTest(session(), one)).not.toContain("routeTable");
    const two = toTest(session(), { navs: [], stores: [], routes: [cartRoutes, orders] });
    expect(lines(two)).toContain('import { routeTable } from "@keel/router";');
    expect(lines(two)).toContain("const routes = routeTable(cartRoutes, ordersRoutes);");
    const odd = toTest(session(), {
      navs: [],
      stores: [],
      routes: [{ module: "my-cart.v2", from: "../routes.ts", contract: "../c.ts" }, orders],
    });
    expect(lines(odd)).toContain('import { routes as my_cart_v2Routes } from "../routes.ts";');
    expect(lines(odd)).toContain("const routes = routeTable(my_cart_v2Routes, ordersRoutes);");
    const none = toTest(session(), { navs: [], stores: [], routes: [] });
    expect(lines(none)).toContain("const routes = routeTable();");
    expect(none).not.toContain("@keel/router");
  });

  test("a module's route name that is taken gets the Store suffix rule too", () => {
    const source = toTest(session(), {
      navs: [],
      stores: [{ id: "x.cartRoutes", name: "cartRoutes", from: "../x.ts" }],
      routes: [cartRoutes, orders],
    });
    expect(lines(source)).toContain('import { routes as cartRoutesStore } from "../routes.ts";');
    expect(lines(source)).toContain("const routes = routeTable(cartRoutesStore, ordersRoutes);");
  });

  test("a navigation is written through its module's contract, imported once, with trailing empty arguments left out", () => {
    const s = session({
      events: [nav(1, "/cart"), nav(2, "/cart/c1"), nav(3, "/cart?tab=a"), nav(4, "/cart/c1?tab=a")],
    });
    const source = toTest(s, {
      ...one,
      navs: [
        { index: 0, id: "cart.show", params: {}, search: {} },
        { index: 1, id: "cart.item", params: { cartId: "c1" }, search: {} },
        { index: 2, id: "cart.show", params: {}, search: { tab: "a" } },
        { index: 3, id: "cart.item", params: { cartId: "c1" }, search: { tab: "a" } },
      ],
    });
    expect(lines(source).filter((l) => l.includes("contract"))).toEqual([
      'import { cart } from "../cart.contract.ts";',
    ]);
    expect(body(source).filter((l) => l.includes("navigate"))).toEqual([
      '  await h.navigate(cart.href("cart.show"));',
      '  await h.navigate(cart.href("cart.item", {"cartId":"c1"}));',
      '  await h.navigate(cart.href("cart.show", {}, {"tab":"a"}));',
      '  await h.navigate(cart.href("cart.item", {"cartId":"c1"}, {"tab":"a"}));',
    ]);
  });

  test("a contract whose name is taken, or is no identifier, is imported under another", () => {
    const s = session({ events: [nav(1, "/a"), nav(2, "/b")] });
    const source = toTest(s, {
      navs: [
        { index: 0, id: "cart.show", params: {}, search: {} },
        { index: 1, id: "my-app.home", params: {}, search: {} },
      ],
      stores: [{ id: "cart.cart", name: "cart", from: "../cart.ts" }],
      routes: [
        cartRoutes,
        { module: "my-app", from: "../../my-app/routes.ts", contract: "../../my-app/my-app.contract.ts" },
      ],
    });
    expect(lines(source)).toContain('import { cart as cartContract } from "../cart.contract.ts";');
    expect(lines(source)).toContain('import { my-app as my_app } from "../../my-app/my-app.contract.ts";');
    expect(body(source).filter((l) => l.includes("navigate"))).toEqual([
      '  await h.navigate(cartContract.href("cart.show"));',
      '  await h.navigate(my_app.href("my-app.home"));',
    ]);
  });

  test("a nav with no route match, or to a module that is not served, is left out and does not move the clock", () => {
    const s = session({
      events: [
        nav(10, "/unmatched"),
        nav(20, "/elsewhere"),
        nav(30, "/noModule"),
        { at: 31, kind: "fire", id: "a", event: { type: "click" } },
      ],
    });
    const source = toTest(s, {
      ...one,
      navs: [
        { index: 1, id: "orders.show", params: {}, search: {} },
        { index: 2, id: "nodot", params: {}, search: {} },
      ],
    });
    expect(source).not.toContain("navigate");
    expect(source).not.toContain("contract");
    expect(body(source).slice(3, -2)).toEqual(["  ctx.clock.advance(31);", '  await h.fire("a", {"type":"click"});']);
  });

  test("the nav a match belongs to is the event at its index, not the next nav", () => {
    const s = session({ events: [nav(1, "/first"), nav(2, "/second")] });
    const source = toTest(s, { ...one, navs: [{ index: 1, id: "cart.second", params: {}, search: {} }] });
    expect(body(source).filter((l) => l.includes("navigate") || l.includes("advance"))).toEqual([
      "  ctx.clock.advance(2);",
      '  await h.navigate(cart.href("cart.second"));',
    ]);
  });
});

describe("toTest: properties", () => {
  test("whatever the typed values, the file parses and holds each of them as a JSON literal", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { maxLength: 6 }),
        fc.stringMatching(/^[0-9a-f]{12}$/),
        (values, fingerprint) => {
          const events = values.map((value, i) => ({
            at: i,
            kind: "fire",
            id: `cart.field${i}`,
            event: { type: "input", value },
          }));
          const source = toTest(session({ fingerprint, events }), one);
          expect(parseTs("modules/cart/test/session.test.ts", source)).toBeDefined();
          for (const [i, value] of values.entries())
            expect(source).toContain(`  await h.fire("cart.field${i}", ${JSON.stringify({ type: "input", value })});`);
          expect(lines(source)[0]).toBe(`// Session: ${fingerprint}, seed 1337`);
          expect(source.endsWith("  expect(rec.errors()).toEqual([]);\n  h.dispose();\n});\n")).toBe(true);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
