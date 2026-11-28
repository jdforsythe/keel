// Examples for a store's `keys`: the `{ name, key }` of its latest keyed commits.
import { effect, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { invariant, store, transaction, tx } from "../src/index.ts";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });

function make(logLimit?: number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const bag = store(Bag, { items: [] }, logLimit === undefined ? {} : { logLimit });
    const push = transaction(bag, "bag.push", Push, (st, { v }) => ({ items: [...st.items, v] }));
    invariant(bag, (st) => st.items.every((v) => v >= 0));
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

describe("@keel/store write keys", () => {
  it("undo and undoWhere leave keys as they are", () => {
    const k = make();
    tx(k.push, { v: 1 }, { key: "a" });
    tx(k.push, { v: 2 }, { key: "b" });
    expect(k.bag.undoWhere(() => true)).toBe(true);
    expect(k.bag.undo()).toBe(true);
    expect(k.bag.snapshot().keys).toEqual([
      { name: "bag.push", key: "a" },
      { name: "bag.push", key: "b" },
    ]);
    expect(tx(k.push, { v: 3 }, { key: "b" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([]);
    k.dispose();
  });

  it("a refused or matched write appends nothing to keys", () => {
    const k = make();
    expect(tx(k.push, { v: -1 }, { key: "bad" }).ok).toBe(false);
    expect(tx(k.push, { v: 1 }, { key: "a" }).ok).toBe(true);
    expect(tx(k.push, { v: 2 }, { key: "a" }).ok).toBe(true);
    expect(k.bag.snapshot().keys).toEqual([{ name: "bag.push", key: "a" }]);
    expect(tx(k.push, { v: 3 }, { key: "bad" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1, 3]);
    k.dispose();
  });

  it("a matched write reruns no reader", () => {
    const k = make();
    tx(k.push, { v: 1 }, { key: "a" });
    let runs = 0;
    const sc = scope(
      () => {
        effect(() => {
          k.bag.head();
          k.bag.get("items");
          runs++;
        });
      },
      { detached: true },
    );
    expect(tx(k.push, { v: 2 }, { key: "a" }).ok).toBe(true);
    expect(runs).toBe(1);
    sc.dispose();
    k.dispose();
  });

  it("logLimit 0 still keeps keys, so a repeated key commits nothing", () => {
    const k = make(0);
    tx(k.push, { v: 1 }, { key: "a" });
    expect(k.bag.snapshot().keys).toEqual([{ name: "bag.push", key: "a" }]);
    expect(tx(k.push, { v: 2 }, { key: "a" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1]);
    k.dispose();
  });

  it("a snapshot's keys is a copy the store does not share", () => {
    const k = make();
    tx(k.push, { v: 1 }, { key: "a" });
    const snap = k.bag.snapshot();
    expect(snap.keys).not.toBe(k.bag.snapshot().keys);
    expect(snap.keys[0]).not.toBe(k.bag.snapshot().keys[0]);
    k.dispose();
  });

  it("restore takes the snapshot's keys over its log entries' keys", () => {
    const src = make();
    tx(src.push, { v: 1 }, { key: "a" });
    const dst = make();
    expect(dst.bag.restore({ ...src.bag.snapshot(), keys: [{ name: "bag.push", key: "z" }] }).ok).toBe(true);
    expect(dst.bag.snapshot().keys).toEqual([{ name: "bag.push", key: "z" }]);
    expect(tx(dst.push, { v: 2 }, { key: "a" }).ok).toBe(true);
    expect(dst.bag.get("items")).toEqual([1, 2]);
    src.dispose();
    dst.dispose();
  });

  it("a snapshot whose log this code cannot replay keeps its keys, or its log entries' keys", () => {
    const src = make();
    tx(src.push, { v: 1 }, { key: "a" });
    const snap = src.bag.snapshot();
    const foreign = { ...snap.log[0], name: "bag.gone" };
    const dst = make();
    expect(dst.bag.restore({ ...snap, log: [foreign] }).ok).toBe(true);
    expect(dst.bag.log()).toEqual([]);
    expect(dst.bag.snapshot().keys).toEqual([{ name: "bag.push", key: "a" }]);
    const { keys: _keys, ...bare } = snap;
    expect(dst.bag.restore({ ...bare, log: [foreign] }).ok).toBe(true);
    expect(dst.bag.snapshot().keys).toEqual([{ name: "bag.gone", key: "a" }]);
    src.dispose();
    dst.dispose();
  });

  it("a refused restore leaves keys unchanged", () => {
    const k = make();
    tx(k.push, { v: 1 }, { key: "a" });
    const r = k.bag.restore({ ...k.bag.snapshot(), keys: [{ name: "bag.push", key: "x".repeat(65) }] });
    expect(r.ok).toBe(false);
    expect(k.bag.snapshot().keys).toEqual([{ name: "bag.push", key: "a" }]);
    k.dispose();
  });
});
