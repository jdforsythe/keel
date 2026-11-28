// A write key's reach: `keyLimit` bounds the remembered keys, apart from `logLimit` (k.sync Write key). Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });

function make(limits: { logLimit?: number; keyLimit?: number }) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const bag = store(Bag, { items: [] }, limits);
    const push = transaction(bag, "bag.push", Push, (st, { v }) => ({ items: [...st.items, v] }));
    return { bag, push };
  };
  const sc = scope(
    () => {
      box.kit = build();
    },
    { detached: true },
  );
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}

test("with logLimit 0 a retried key commits once", () => {
  const k = make({ logLimit: 0 });
  tx(k.push, { v: 1 }, { key: "k" });
  tx(k.push, { v: 1 }, { key: "k" });
  expect(k.bag.get("items")).toEqual([1]);
  k.dispose();
});

test("a key retried after logLimit other keyed writes commits once", () => {
  const k = make({ logLimit: 2 });
  tx(k.push, { v: 1 }, { key: "k1" });
  tx(k.push, { v: 2 }, { key: "k2" });
  tx(k.push, { v: 3 }, { key: "k3" });
  tx(k.push, { v: 1 }, { key: "k1" });
  expect(k.bag.get("items")).toEqual([1, 2, 3]);
  k.dispose();
});

test("a keyLimit that is not a positive integer throws the options error", () => {
  for (const keyLimit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
    expect(() => make({ keyLimit })).toThrow(`keyLimit ${keyLimit} is not a positive integer`);
});

test("a retried key commits again exactly once keyLimit later keyed commits passed it, whatever logLimit", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 0, max: 8 }),
      fc.integer({ min: 0, max: 12 }),
      (keyLimit, logLimit, later) => {
        const k = make({ keyLimit, logLimit });
        tx(k.push, { v: 0 }, { key: "first" });
        for (let i = 0; i < later; i++) tx(k.push, { v: 1 }, { key: `n${i}` });
        const head = k.bag.head();
        tx(k.push, { v: 2 }, { key: "first" });
        expect(k.bag.head()).toBe(later >= keyLimit ? head + 1 : head);
        expect(k.bag.snapshot().keys.length).toBeLessThanOrEqual(keyLimit);
        k.dispose();
      },
    ),
    { seed: 1337, numRuns: 200 },
  );
});
