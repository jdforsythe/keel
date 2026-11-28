// Example tests that pin renameSource's skip rules and string handling through a store rename (backlog 0097).
import { describe, expect, it } from "vitest";
import { type Files, apply } from "./helpers.ts";

const PAGE = "modules/orders/Panel.tsx";

function renamed(page: string, extra: Record<string, string> = {}): string {
  let f: Files = apply("project", { name: "shop" }, new Map());
  f = apply("module", { id: "orders" }, f);
  f = apply("store", { id: "orders.cart" }, f);
  f.set(PAGE, page);
  for (const [p, s] of Object.entries(extra)) f.set(p, s);
  return apply("rename", { kind: "store", from: "orders.cart", to: "orders.basket" }, f).get(PAGE) ?? "";
}

describe("renameSource: names that are not references", () => {
  it("class members, type members and qualified names keep the old name", () => {
    const page = [
      "import { cart } from './cart.store.ts'",
      "class K { cart = 1; cart2 = cart; cart() { return cart } }",
      "type T = { cart: number; cart(): void }",
      "interface I { cart: string; cart(): void }",
      "type Q = ns.cart",
      "const o = { cart: 1 }.cart",
      "const m = ns.cart + cart",
      "const c = ns[cart]",
      "",
    ].join("\n");
    expect(renamed(page)).toBe(
      [
        "import { basket } from './basket.store.ts'",
        "class K { cart = 1; cart2 = basket; cart() { return basket } }",
        "type T = { cart: number; cart(): void }",
        "interface I { cart: string; cart(): void }",
        "type Q = ns.cart",
        "const o = { cart: 1 }.cart",
        "const m = ns.cart + basket",
        "const c = ns[basket]",
        "",
      ].join("\n"),
    );
  });

  it("computed keys are references; JSX attribute names and members are not", () => {
    const page = [
      "import { cart } from './cart.store.ts'",
      "const o = { [cart]: 1, cart: 2 }",
      "const a = <Box cart={cart} />",
      "const b = <ns.cart />",
      "const c = <cart.Item cart={1} />",
      "",
    ].join("\n");
    const out = renamed(page);
    expect(out).toContain("{ [basket]: 1, cart: 2 }");
    expect(out).toContain("<Box cart={basket} />");
    expect(out).toContain("<ns.cart />");
    expect(out).toContain("<basket.Item cart={1} />");
  });

  it("a source that does not parse is returned unchanged", () => {
    const bad = "import { cart } from './cart.store.ts'\nconst = (\n";
    expect(renamed(bad)).toBe(bad);
  });

  it("an unchanged identifier reference writes nothing and untouched files stay byte-identical", () => {
    const page = "export const n = 1\n";
    expect(renamed(page)).toBe(page);
  });
});

describe("renameSource: strings and templates", () => {
  it("template text follows id shapes; expressions inside are renamed", () => {
    const page = [
      "import { cart } from './cart.store.ts'",
      "const a = `orders.cart ${cart} cart-icon`",
      "const b = `x orders.cart.total y`",
      "",
    ].join("\n");
    expect(renamed(page)).toBe(
      [
        "import { basket } from './basket.store.ts'",
        "const a = `orders.basket ${basket} cart-icon`",
        "const b = `x orders.basket.total y`",
        "",
      ].join("\n"),
    );
  });

  it("find/fire/a11y first arguments are id positions, other calls are not", () => {
    const page = [
      "import { cart } from './cart.store.ts'",
      "t.find('cart-row'); fire('cart-row'); a11y('cart-row'); other('cart-row'); find.x('cart-row')",
      "t.find(cart)",
      "const w = { id: 'cart-x', id2: 'cart-x' }",
      "",
    ].join("\n");
    const out = renamed(page);
    expect(out).toContain("t.find('basket-row'); fire('basket-row'); a11y('basket-row'); other('cart-row')");
    expect(out).toContain("find.x('cart-row')");
    expect(out).toContain("t.find(basket)");
    expect(out).toContain("{ id: 'basket-x', id2: 'cart-x' }");
  });

  it("import specifiers: moved files are restyled, unresolved ones follow the renamed stem", () => {
    const page = [
      "import a from './cart.store.ts'",
      "import b from './cart.store'",
      "import c from './cart.store.js'",
      "import d from './cart.missing.ts'",
      "import e from './cart'",
      "import f from './carts'",
      "import g from 'cart'",
      "export * from './cart.store.ts'",
      "const h = import('./cart.store.ts')",
      "",
    ].join("\n");
    const out = renamed(page);
    expect(out).toContain("import a from './basket.store.ts'");
    expect(out).toContain("import b from './basket.store'");
    expect(out).toContain("import c from './basket.store.js'");
    expect(out).toContain("import d from './basket.missing.ts'");
    expect(out).toContain("import e from './basket'");
    expect(out).toContain("import f from './carts'");
    expect(out).toContain("import g from 'cart'");
    expect(out).toContain("export * from './basket.store.ts'");
    expect(out).toContain("import('./basket.store.ts')");
  });

  it("route rename: path literal segments follow only in the contract entry's path", () => {
    let f: Files = apply("project", { name: "shop" }, new Map());
    f = apply("module", { id: "orders" }, f);
    f = apply("route", { id: "orders.show", path: "/show/:id/show" }, f);
    f = apply("route", { id: "orders.keep", path: "/show/keep" }, f);
    const out = apply("rename", { kind: "route", from: "orders.show", to: "orders.view" }, f).get(
      "modules/orders/orders.contract.ts",
    );
    expect(out).toContain('path: "/view/:id/view"');
    expect(out).toContain('path: "/show/keep"');
  });
});
