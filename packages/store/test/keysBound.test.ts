// A write key's reach against `logLimit`. Each `test.fails` holds behaviour k.sync does not state yet (keys bounded
// apart from the log); it passes once the spec states it and the code follows.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { expect, test } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });

function make(logLimit: number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const bag = store(Bag, { items: [] }, { logLimit });
    const push = transaction(bag, "bag.push", Push, (st, { v }) => ({ items: [...st.items, v] }));
    return { bag, push };
  };
  const sc = scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}

test.fails("with logLimit 0 a retried key commits once (k.sync keeps the last logLimit keys)", () => {
  const k = make(0);
  tx(k.push, { v: 1 }, { key: "k" });
  tx(k.push, { v: 1 }, { key: "k" });
  expect(k.bag.get("items")).toEqual([1]);
  k.dispose();
});

test.fails("a key retried after logLimit other keyed writes commits once (k.sync keeps the last logLimit keys)", () => {
  const k = make(2);
  tx(k.push, { v: 1 }, { key: "k1" });
  tx(k.push, { v: 2 }, { key: "k2" });
  tx(k.push, { v: 3 }, { key: "k3" });
  tx(k.push, { v: 1 }, { key: "k1" });
  expect(k.bag.get("items")).toEqual([1, 2, 3]);
  k.dispose();
});
