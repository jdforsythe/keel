// Review fixes (D18, D19): data keys never change; string ids change only as whole segments of an id shape.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, RUNS, SEED, apply, lower, snap } from "./helpers.ts";

const PAGE = "modules/orders/Panel.tsx";

function withCart(page: string): Files {
  let f: Files = apply("project", { name: "shop" }, new Map());
  f = apply("module", { id: "orders" }, f);
  f = apply("store", { id: "orders.cart" }, f);
  f = apply("route", { id: "orders.show", path: "/orders/:id" }, f);
  f.set(PAGE, page);
  return f;
}

const renameCart = (f: Files): string =>
  apply("rename", { kind: "store", from: "orders.cart", to: "orders.basket" }, f).get(PAGE) ?? "";

describe("rename: shorthand properties and patterns", () => {
  const page = [
    "import { cart } from './cart.store.ts'",
    "const a = { cart }",
    "const { cart: c } = a",
    "export default function Panel({ cart: x = cart }) {",
    "  const { items } = { items: cart }",
    "  return [a, c, x, items]",
    "}",
    "",
  ].join("\n");

  it("expands `{ cart }` to `{ cart: basket }` so the key stays, and keeps other keys", () => {
    const out = renameCart(withCart(page));
    expect(out).toContain("const a = { cart: basket }");
    expect(out).toContain("const { cart: c } = a");
    expect(out).toContain("function Panel({ cart: x = basket })");
    expect(out).toContain("{ items: basket }");
    expect(out).toContain("import { basket } from './basket.store.ts'");
  });

  it("collapses back to the shorthand on the reverse rename (byte-identical round trip)", () => {
    const f = withCart(page);
    const mid = apply("rename", { kind: "store", from: "orders.cart", to: "orders.basket" }, f);
    const back = apply("rename", { kind: "store", from: "orders.basket", to: "orders.cart" }, mid);
    expect(snap(back)).toBe(snap(f));
  });

  it("expands a shorthand destructuring pattern", () => {
    const out = renameCart(withCart("import { cart } from './cart.store.ts'\nconst { cart } = { cart }\n"));
    expect(out).toContain("const { cart: basket } = { cart: basket }");
  });
});

describe("rename: string ids", () => {
  const page = [
    "import { cart } from './cart.store.ts'",
    "const strings = ['cart-icon', 'cart.json', 'cart', 'my cart', 'orders.cart', 'orders.cart.addItem']",
    "const ids = { id: 'cart-row', other: 'cart-row' }",
    'const html = \'id="cart-1" class="cart-icon"\'',
    "export default function Panel(t: { find: (id: string) => unknown }) {",
    "  t.find('cart.total')",
    '  return <Box id="cart.submit" class="cart-icon" items={cart.get(\'cart\')} />',
    "}",
    "",
  ].join("\n");

  it("bare prefixes and plain strings survive; whole segments of id shapes follow", () => {
    const out = renameCart(withCart(page));
    expect(out).toContain("['cart-icon', 'cart.json', 'cart', 'my cart', 'orders.basket', 'orders.basket.addItem']");
    expect(out).toContain("{ id: 'basket-row', other: 'cart-row' }");
    expect(out).toContain('\'id="basket-1" class="cart-icon"\'');
    expect(out).toContain("t.find('basket.total')");
    expect(out).toContain('<Box id="basket.submit" class="cart-icon" items={basket.get(\'cart\')} />');
  });

  it("an id segment that merely starts with the name is not renamed", () => {
    const out = renameCart(withCart("const a = { id: 'cartx-1' }\nconst b = <Box id=\"carts.total\" />\n"));
    expect(out).toContain("{ id: 'cartx-1' }");
    expect(out).toContain('id="carts.total"');
  });

  it("property: `<name>-<suffix>` and `<name>.<suffix>` outside id positions never change", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,6}$/), lower, (suffix, to) => {
        const s = [`'cart-${suffix}'`, `'cart.${suffix}'`, `"cart-${suffix} cart.${suffix}"`].join(", ");
        const f = withCart(`const s = [${s}]\n`);
        const out = apply("rename", { kind: "store", from: "orders.cart", to: `orders.${to}` }, f).get(PAGE);
        expect(out).toBe(`const s = [${s}]\n`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("rename: route leaf is not an identifier", () => {
  it("a local binding equal to the route leaf is untouched; only a `uses:` entry follows", () => {
    const page = "const show = 1\nexport const shown = { show, uses: [show], n: show + 1 }\n";
    const out =
      apply("rename", { kind: "route", from: "orders.show", to: "orders.view" }, withCart(page)).get(PAGE) ?? "";
    expect(out).toBe("const show = 1\nexport const shown = { show, uses: [view], n: show + 1 }\n");
  });
});
