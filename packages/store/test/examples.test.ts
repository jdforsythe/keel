// Example cases for @keel/store behaviour not pinned by conformance.
import { effect, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { store, transaction, tx } from "../src/index.ts";
import { makeCounter } from "./kit.ts";

describe("@keel/store examples", () => {
  it("get(key) reruns an effect only when that key changes", () => {
    const k = makeCounter();
    let runs = 0;
    scope(() => {
      effect(() => {
        k.c.get("tags");
        runs++;
      });
    });
    tx(k.add, { by: 1 });
    expect(runs).toBe(1);
    tx(k.tag, { tag: "x" });
    expect(runs).toBe(2);
  });

  it("committed state, log payloads and snapshots are isolated from caller objects", () => {
    const k = makeCounter();
    const payload = { tag: "a" };
    tx(k.tag, payload);
    payload.tag = "b";
    expect(k.c.log()[0]?.payload).toEqual({ tag: "a" });
    expect(Object.isFrozen(k.c.get("tags"))).toBe(true);
    const snap = k.c.snapshot();
    expect(Object.isFrozen(snap.state)).toBe(false);
    expect(snap.state).not.toBe(k.c.snapshot().state);
  });

  it("restore rejects a malformed snapshot with schema.invalid and changes nothing", () => {
    const k = makeCounter();
    tx(k.add, { by: 2 });
    const before = JSON.stringify([k.c.snapshot(), k.c.log()]);
    for (const bad of [null, {}, { state: { n: 1, tags: [] }, log: [{ id: 1, name: "nope", payload: {}, at: 1 }] }]) {
      const r = k.c.restore(bad);
      expect(r.ok ? undefined : r.error.code).toBe("schema.invalid");
    }
    const wrongPayload = {
      state: { n: 1, tags: [] },
      log: [{ id: 1, name: "counter.add", payload: { by: "x" }, at: 1 }],
    };
    expect(k.c.restore(wrongPayload).ok).toBe(false);
    expect(JSON.stringify([k.c.snapshot(), k.c.log()])).toBe(before);
  });

  it("a uses declaration stops applying once its scope is disposed", () => {
    const k = makeCounter();
    const declaring = scope(() => k.c.uses([k.add]));
    expect(tx(k.reset, {}).ok).toBe(false);
    declaring.dispose();
    expect(tx(k.reset, {}).ok).toBe(true);
  });

  it("uses outside a scope throws (E1203)", () => {
    const k = makeCounter();
    expect(() => k.c.uses([k.add])).toThrow(/E1203/);
  });

  it("duplicate or empty transaction names throw", () => {
    const k = makeCounter();
    expect(() => scope(() => transaction(k.c, "counter.add", s.object({}), (st) => st))).toThrow();
    expect(() => scope(() => transaction(k.c, "", s.object({}), (st) => st))).toThrow();
  });

  it("a transaction returning state outside the schema throws and commits nothing", () => {
    const box: { run?: () => unknown; size?: () => number } = {};
    scope(() => {
      const c = store(s.object({ n: s.int() }), { n: 0 });
      const bad = transaction(c, "n.half", s.object({}), (st) => ({ n: st.n + 0.5 }));
      box.run = () => tx(bad, {});
      box.size = () => c.log().length + c.snapshot().state.n;
    });
    expect(() => box.run?.()).toThrow(/n.half/);
    expect(box.size?.()).toBe(0);
  });

  it("an invalid initial state throws at creation", () => {
    expect(() => scope(() => store(s.object({ n: s.int() }), { n: 1.5 }))).toThrow(/initial/);
  });
});
