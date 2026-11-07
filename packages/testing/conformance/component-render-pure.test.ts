// @vitest-environment happy-dom
// Spec: k.component, clause "Render is pure for equal props and state."
// Spec: k.component, clause "A11y tree snapshot stable across re-renders."
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compiled } from "./component-support.ts";
import { CartView, SEED, cart, simCtx } from "./fixtures.ts";

const Card = compiled(
  "Card",
  `export default function Card(props) {
  return <section id="card"><h1>{props.title}</h1><button id="card.go" aria-label={props.note}>{props.count}</button></section>
}`,
  s.object({ title: s.string(), note: s.string(), count: s.int() }),
);

const snapshot = (t: ReturnType<typeof render>, ids: readonly string[]) => ({
  a11y: t.a11y(),
  found: ids.map((id) => t.find(id)),
  state: t.state(),
});

describe("k.component: render is pure for equal props and state", () => {
  it("two renders with equal props give equal a11y trees, found elements and state", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.integer(), (title, note, count) => {
        const props = { title, note, count };
        const a = render(Card.component, { props, ctx: simCtx() });
        const b = render(Card.component, { props, ctx: simCtx() });
        expect(snapshot(b, Card.ids)).toEqual(snapshot(a, Card.ids));
        expect(a.find("card.go").text).toBe(String(count));
        a.dispose();
        b.dispose();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("two renders with equal props and equal store state give equal a11y trees and state", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ id: fc.string(), qty: fc.integer() }), { maxLength: 4 }), (items) => {
        const open = () => render(CartView, { props: { compact: false }, state: [[cart, { items }]], ctx: simCtx() });
        const a = open();
        const b = open();
        expect(b.a11y()).toEqual(a.a11y());
        expect(b.state()).toEqual(a.state());
        expect(b.find("cart.total").text).toBe(String(items.length));
        a.dispose();
        b.dispose();
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("rendering does not change the inputs: the same props render again to the same tree after a first render", () => {
    const props = { title: "T", note: "N", count: 3 };
    const first = render(Card.component, { props, ctx: simCtx() });
    const tree = first.a11y();
    first.dispose();
    const second = render(Card.component, { props, ctx: simCtx() });
    expect(second.a11y()).toEqual(tree);
    second.dispose();
  });
});

describe("k.component: the full a11y snapshot is stable across re-renders", () => {
  it("the whole tree (id, role, name, state, children) is equal after structure-preserving updates", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (clicks) => {
        const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
        const before = t.a11y();
        for (let i = 0; i < clicks; i++) {
          await t.fire("cart.add", { type: "click" });
          await t.settle();
          expect(t.a11y()).toEqual(before);
        }
        expect(t.a11y()).toEqual(before);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a11y() read repeatedly without changes returns equal trees", () => {
    const t = render(Card.component, { props: { title: "T", note: "N", count: 1 }, ctx: simCtx() });
    expect(t.a11y()).toEqual(t.a11y());
    t.dispose();
  });
});
