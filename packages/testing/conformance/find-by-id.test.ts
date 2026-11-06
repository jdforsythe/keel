// @vitest-environment happy-dom
// Spec: k.testing, "find(id) returns { id, role, name, text, state }, never a DOM node." Seed: 1337.
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Button, CartView, cart, simCtx } from "./fixtures.ts";

describe("k.testing: find(id) resolves ids and returns the element description", () => {
  it("find(id) returns { id, role, name, text, state }", () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(t.find("save")).toMatchObject({ id: "save", role: "button", name: "Save", text: "Save" });
    expect(t.find("save")).toHaveProperty("state");
    t.dispose();
  });

  it("find(id) never returns a DOM node", () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(t.find("save")).not.toBeInstanceOf(Node);
    expect(t.find("save")).not.toHaveProperty("querySelector");
    t.dispose();
  });

  it("find(id) reflects current text after a fire", async () => {
    const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
    expect(t.find("cart.total").text).toBe("0");
    await t.fire("cart.add", { type: "click" });
    expect(t.find("cart.total").text).toBe("1");
    t.dispose();
  });
});
