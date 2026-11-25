import { attr, clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
// @vitest-environment happy-dom
// Spec: k.testing, clause "`render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), ctx, dispose() }`; `ctx` is the one it runs on (`SimCtx` if none given). `props` (an open `Props` object: its declared keys, slot and callback props passed as given, k.component) and each `[store, value]` in `state` are schema-parsed first."
// Spec: k.testing, clause "`render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering."
// Seed: 1337.
// Reading: "an open `Props` object: its declared keys ... are schema-parsed first" is asserted as: a declared key is parsed (a failing one rejects `schema.invalid`, the body never runs; a valid one reaches the body as parsed); a key `Props` does not declare is no part of the parse, so a value of any kind there (a function, a slot, a Map, a class instance, `undefined`, `NaN`) neither fails `render` nor is copied: the body receives that very value.
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, cart, codeOf, simCtx, thrown } from "./fixtures.ts";

const T = template('<p id="seen"></p>');
const log: { props: unknown[]; runs: number } = { props: [], runs: 0 };
type SeenProps = { readonly n: number; readonly onPick?: () => void; readonly extra?: unknown };
const Seen = Object.assign(
  (props: SeenProps): Node => {
    log.runs++;
    log.props.push(props);
    const root = clone(T);
    attr(root instanceof Element ? root : document.createElement("p"), "data-n", () => String(props.n));
    return root;
  },
  { Props: s.object({ n: s.int() }) },
);

const extras: readonly (readonly [string, () => unknown])[] = [
  ["callback", () => () => 1],
  ["slot returning a node", () => () => document.createElement("span")],
  ["Map", () => new Map([["k", "v"]])],
  ["class instance", () => new (class {})()],
  ["Date", () => Reflect.construct(Date, [0])],
  ["undefined", () => undefined],
  ["NaN", () => Number.NaN],
  ["bigint", () => 1n],
  ["symbol key holder", () => ({ [Symbol("k")]: "v" })],
  ["plain object", () => ({ a: [1, "b", null] })],
  ["string", () => "v"],
];

describe("k.testing: render parses only an open Props schema's declared keys", () => {
  it("a key Props does not declare, holding a value of any kind, does not fail render and reaches the body as given", () => {
    for (const [name, make] of extras) {
      log.props = [];
      const given = make();
      const t = render(Seen, { props: { n: 1, extra: given }, ctx: simCtx() });
      expect(log.props.length, name).toBe(1);
      expect(Object.is(Reflect.get(Object(log.props[0]), "extra"), given), name).toBe(true);
      t.dispose();
    }
  });

  it("a callback and a slot passed beside the declared keys reach the body as the same functions", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (n) => {
        log.props = [];
        const onPick = (): void => undefined;
        const slot = (): Node => document.createElement("i");
        const t = render(Seen, { props: { n, onPick, extra: slot }, ctx: simCtx() });
        const got = log.props[0];
        expect(Reflect.get(Object(got), "n")).toBe(n);
        expect(Reflect.get(Object(got), "onPick")).toBe(onPick);
        expect(Reflect.get(Object(got), "extra")).toBe(slot);
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("a declared key that fails its schema rejects schema.invalid before rendering, whatever sits at the undeclared keys", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.string(), fc.double({ noInteger: true, noNaN: true }), fc.boolean()),
        fc.constantFrom(...extras),
        async (bad, [, make]) => {
          log.runs = 0;
          const e = await thrown(() => render(Seen, { props: { n: bad, extra: make() }, ctx: simCtx() }));
          expect(codeOf(e)).toBe("schema.invalid");
          expect(log.runs).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("each [store, value] in state is schema-parsed first: a value its store's schema refuses rejects schema.invalid before rendering", async () => {
    const bad = { items: [{ id: 1, qty: "x" }] };
    log.runs = 0;
    const e = await thrown(() =>
      Reflect.apply(render, undefined, [Seen, { props: { n: 1 }, state: [[cart, bad]], ctx: simCtx() }]),
    );
    expect(codeOf(e)).toBe("schema.invalid");
    expect(log.runs).toBe(0);
    const t = render(Seen, { props: { n: 1 }, state: [[cart, { items: [{ id: "a", qty: 2 }] }]], ctx: simCtx() });
    expect(t.state(cart)).toEqual({ items: [{ id: "a", qty: 2 }] });
    t.dispose();
  });
});
