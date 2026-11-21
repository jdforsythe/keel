// `toTest` writes each matched `nav` as `h.navigate(<contract>.href(...))`, importing the nav module's contract
// (renamed when a store takes its name), and joins several serving modules with `routeTable`. Seed 1337
import { expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { toTest } from "../src/toTest.ts";

const parsed = Session.parse({
  v: 1,
  id: "s1",
  seed: 1337,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [
    { at: 5, kind: "nav", href: "/cart?q=a" },
    { at: 9, kind: "nav", href: "/shop/7" },
  ],
  error: null,
  fingerprint: "f",
});
if (!parsed.ok) throw new Error("fixture session does not parse");
const session = parsed.value;
const routes = [
  { module: "cart", from: "../routes.ts", contract: "../cart.contract.ts" },
  { module: "shop", from: "../../shop/routes.ts", contract: "../../shop/shop.contract.ts" },
];

test("each nav goes through its module's contract href, and several modules are one routeTable", () => {
  const text = toTest(session, {
    navs: [
      { index: 0, id: "cart.show", params: {}, search: { q: "a" } },
      { index: 1, id: "shop.item", params: { id: "7" }, search: {} },
    ],
    stores: [{ id: "cart", name: "cart", from: "../cart.ts" }],
    routes,
  });
  expect(text).toContain('import { routeTable } from "@keel/router";');
  expect(text).toContain('import { cart as cartContract } from "../cart.contract.ts";');
  expect(text).toContain('import { shop } from "../../shop/shop.contract.ts";');
  expect(text).toContain("const routes = routeTable(cartRoutes, shopRoutes);");
  expect(text).toContain('await h.navigate(cartContract.href("cart.show", {}, {"q":"a"}));');
  expect(text).toContain('await h.navigate(shop.href("shop.item", {"id":"7"}));');
  expect(text).not.toContain("routes.href");
});

test("one serving module imports its routes as is and no contract when no nav matched", () => {
  const text = toTest(session, { navs: [], stores: [], routes: routes.slice(0, 1) });
  expect(text).toContain('import { routes } from "../routes.ts";');
  expect(text).not.toContain("contract.ts");
  expect(text).not.toContain("h.navigate");
});
