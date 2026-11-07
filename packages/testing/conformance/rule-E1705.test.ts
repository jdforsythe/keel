// @vitest-environment happy-dom
// Spec: k.testing, Rules "E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids)"
// Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

const mountCart = () => render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });

describe("k.testing: E1705 fire or find with an id absent from ids.json", () => {
  it("E1705 find with an absent id fails with E1705", async () => {
    const t = mountCart();
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^zz[a-z]{3,8}$/), async (id) => {
        expect(codeOf(await thrown(() => t.find(id)))).toBe("E1705");
      }),
      { seed: SEED, numRuns: 25 },
    );
    t.dispose();
  });

  it("E1705 fire with an absent id rejects with E1705", async () => {
    const t = mountCart();
    expect(codeOf(await thrown(() => t.fire("zzmissing", { type: "click" })))).toBe("E1705");
    t.dispose();
  });

  it("E1705 the message lists the nearest ids", async () => {
    const t = mountCart();
    const msg = messageOf(await thrown(() => t.find("cart.ad")));
    expect(msg).toContain("E1705");
    expect(msg).toContain("cart.add");
    t.dispose();
  });
});
