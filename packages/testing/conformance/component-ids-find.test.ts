// @vitest-environment happy-dom
// Spec: k.component, clause "Every element addressable by id in the harness."
// k.component Seed: 1337.
// Every `ids.json` key of a compiled component resolves through the harness `find(id)`.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compiled } from "./component-support.ts";
import { SEED, simCtx } from "./fixtures.ts";

const NoProps = s.object({});

describe("k.component: every element is addressable by id in the harness", () => {
  it("an explicit id and derived ids all resolve through find(id)", () => {
    const c = compiled(
      "Cart",
      `export default function Cart() { return <div><button id="cart.submit">Go</button><span>x</span></div> }`,
      NoProps,
    );
    expect(c.ids).toHaveLength(3);
    expect(c.ids).toContain("cart.submit");
    const t = render(c.component, { props: {}, ctx: simCtx() });
    for (const id of c.ids) expect(t.find(id).id).toBe(id);
    expect(t.find("cart.submit")).toMatchObject({ role: "button", name: "Go", text: "Go" });
    t.dispose();
  });

  it("for any number of elements, every derived <file>.<index> key resolves through find(id)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (n) => {
        const kids = Array.from({ length: n }, (_, i) => `<span>k${i}</span>`).join("");
        const c = compiled("List", `export default function List() { return <div>${kids}</div> }`, NoProps);
        expect(c.ids).toHaveLength(n + 1);
        const t = render(c.component, { props: {}, ctx: simCtx() });
        c.ids.forEach((id, i) => {
          expect(id).toBe(`List.${i}`);
          expect(t.find(id).id).toBe(id);
        });
        for (let i = 0; i < n; i++) expect(t.find(`List.${i + 1}`).text).toBe(`k${i}`);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("an id absent from ids.json does not resolve", () => {
    const c = compiled("One", `export default function One() { return <p>x</p> }`, NoProps);
    const t = render(c.component, { props: {}, ctx: simCtx() });
    expect(() => t.find("One.9")).toThrow(/E1705/);
    t.dispose();
  });
});
