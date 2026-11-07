// @vitest-environment happy-dom
// Spec: k.testing, a11y "`a11y(id?)` is built from the live DOM"
// Spec: k.component, clause "a11y tree snapshot stable across re-renders"
// Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, flatten, simCtx } from "./fixtures.ts";

const mountCart = () => render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });

describe("k.testing: a11y() returns a tree of { id, role, name, state } built from the live DOM", () => {
  it("every node has id, role, name, state and children", () => {
    const t = mountCart();
    const nodes = flatten(t.a11y());
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n).toHaveProperty("id");
      expect(n).toHaveProperty("role");
      expect(n).toHaveProperty("name");
      expect(n).toHaveProperty("state");
      expect(n).toHaveProperty("children");
    }
    t.dispose();
  });

  it("the tree reflects the live DOM: the button node is a button named Add", () => {
    const t = mountCart();
    expect(flatten(t.a11y()).find((n) => n.id === "cart.add")).toMatchObject({ role: "button", name: "Add" });
    t.dispose();
  });

  it("a11y(id) returns exactly the node with that id", () => {
    const t = mountCart();
    const whole = flatten(t.a11y()).find((n) => n.id === "cart.add");
    expect(t.a11y("cart.add")).toMatchObject({ id: "cart.add", role: "button", name: "Add" });
    expect(t.a11y("cart.add")).toEqual(whole);
    t.dispose();
  });

  it("a11y tree is stable across re-renders that do not change structure", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (clicks) => {
        const t = mountCart();
        // Clicks change text of #cart.total (a status node) but not structure; compare ids and roles only.
        const shape = (tree: unknown) => flatten(tree).map((n) => [n.id, n.role]);
        const shapeBefore = shape(t.a11y());
        for (let i = 0; i < clicks; i++) await t.fire("cart.add", { type: "click" });
        expect(shape(t.a11y())).toEqual(shapeBefore);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("two renders of equal props yield equal a11y trees", () => {
    const a = mountCart();
    const b = mountCart();
    expect(b.a11y()).toEqual(a.a11y());
    a.dispose();
    b.dispose();
  });
});
