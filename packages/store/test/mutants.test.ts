// Targeted examples pinning error messages, error data, reactive tracking and freeze edge cases.
import { effect, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { invariant, store, transaction, tx } from "../src/index.ts";
import { freeze } from "../src/internal/freeze.ts";
import { logSchema } from "../src/internal/logSchema.ts";
import { makeCounter } from "./kit.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

describe("freeze", () => {
  it("freezes nested plain data and returns the same reference", () => {
    const v = { a: { b: [1, { c: 2 }] } };
    expect(freeze(v)).toBe(v);
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.a)).toBe(true);
    expect(Object.isFrozen(v.a.b)).toBe(true);
    expect(Object.isFrozen(v.a.b[1])).toBe(true);
  });

  it("skips already-frozen subtrees (shared structure) without descending", () => {
    const inner = { x: 1 };
    const outer = Object.freeze({ inner });
    freeze(outer);
    expect(Object.isFrozen(inner)).toBe(false);
  });

  it("descends into unfrozen parents even when a child is frozen", () => {
    const child = Object.freeze({ k: { deep: 1 } });
    const parent = { child };
    freeze(parent);
    expect(Object.isFrozen(parent)).toBe(true);
    expect(Object.isFrozen(child.k)).toBe(false);
  });

  it("passes primitives and null through", () => {
    expect(freeze(null)).toBe(null);
    expect(freeze(5)).toBe(5);
    expect(freeze("s")).toBe("s");
    expect(freeze(undefined)).toBe(undefined);
  });
});

describe("logSchema", () => {
  it("with no transactions decodes only the empty log, and rejects any entry", () => {
    const codec = logSchema(new Map());
    expect(codec.parse([]).ok).toBe(true);
    expect(codec.parse([{ id: 1, name: "", payload: {}, at: 1 }]).ok).toBe(true);
    expect(codec.parse([{ id: 1, name: "x", payload: {}, at: 1 }]).ok).toBe(false);
    expect(codec.parse([{ id: 1.5, name: "", payload: {}, at: 1 }]).ok).toBe(false);
    expect(codec.parse([{ id: 1, name: "", payload: {}, at: "1" }]).ok).toBe(false);
    expect(codec.parse([{ id: 1, name: "", at: 1 }]).ok).toBe(false);
  });
});

describe("store construction", () => {
  it("a live duplicate id throws naming the store and the reason", () => {
    const sc = scope(() => {
      store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.one" });
    });
    expect(() => scope(() => store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.one" }))).toThrow(
      "store dup.one: id already in use by a live store",
    );
    sc.dispose();
    expect(() => scope(() => store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.one" }))).not.toThrow();
  });

  it("a disposed scope frees its id, but a replacement store keeps its own registration", () => {
    const first = scope(() => {
      store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.two" });
    });
    first.dispose();
    const second = scope(() => {
      store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.two" });
    });
    first.dispose();
    expect(() => scope(() => store(s.object({ n: s.int() }), { n: 0 }, { id: "dup.two" }))).toThrow(/already in use/);
    second.dispose();
  });

  it("creation outside a scope throws E1203 and registers nothing", () => {
    expect(() => store(s.object({ n: s.int() }), { n: 0 }, { id: "outside.one" })).toThrow(/E1203/);
    expect(() => scope(() => store(s.object({ n: s.int() }), { n: 0 }, { id: "outside.one" }))).not.toThrow();
  });

  it("uses outside a scope throws the full E1203 message", () => {
    const k = makeCounter();
    expect(() => k.c.uses([k.add])).toThrow("E1203: uses() called outside any scope; wrap it in scope(fn)");
  });

  it("duplicate transaction name message names store and name", () => {
    const k = makeCounter();
    expect(() => scope(() => transaction(k.c, "counter.add", s.object({}), (st) => st))).toThrow(
      `store ${k.c.id}: transaction name "counter.add" empty or taken`,
    );
  });

  it("supports a non-object root schema: any key read tracks the whole state", () => {
    const box: { push?: () => unknown } = {};
    let runs = 0;
    scope(() => {
      const c = store(s.array(s.int()), [1]);
      const add = transaction(c, "arr.add", s.object({ v: s.int() }), (st, { v }) => [...st, v]);
      box.push = () => tx(add, { v: 2 });
      effect(() => {
        c.get(0);
        runs++;
      });
    });
    expect(runs).toBe(1);
    box.push?.();
    expect(runs).toBe(2);
  });
});

describe("tx error details", () => {
  it("undeclared carries the transaction name and a message", () => {
    const k = makeCounter();
    scope(() => {
      k.c.uses([k.add]);
      const r = tx(k.reset, {});
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe("store.undeclared");
      expect(r.error.message).toBe("counter.reset is not in this scope's uses");
      expect(r.error).toMatchObject({ data: { transaction: "counter.reset" } });
    });
  });

  it("invariant violation carries the transaction name and a message", () => {
    const k = makeCounter();
    scope(() => invariant(k.c, (st) => st.n < 5));
    const r = tx(k.add, { by: 9 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("store.invariant");
    expect(r.error.message).toBe("counter.add violates an invariant");
    expect(r.error).toMatchObject({ data: { transaction: "counter.add" } });
    expect(k.c.get("n")).toBe(0);
    expect(k.c.log()).toHaveLength(0);
  });

  it("check reports rejected schema and invariant failures with messages and empty transaction", () => {
    const k = makeCounter();
    scope(() => invariant(k.c, (st) => st.n < 5));
    const bad = k.c.check({ n: 1.5, tags: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("store.invariant");
      expect(bad.error.message.startsWith("candidate state rejected: ")).toBe(true);
      expect(bad.error.message.length).toBeGreaterThan("candidate state rejected: ".length);
      expect(bad.error).toMatchObject({ data: { transaction: "" } });
    }
    const guarded = k.c.check({ n: 9, tags: [] });
    expect(guarded.ok).toBe(false);
    if (!guarded.ok) {
      expect(guarded.error.code).toBe("store.invariant");
      expect(guarded.error.message).toBe("candidate state violates an invariant");
      expect(guarded.error).toMatchObject({ data: { transaction: "" } });
    }
    const good = k.c.check({ n: 2, tags: ["a"] });
    expect(good.ok).toBe(true);
  });
});

describe("restore", () => {
  it("a valid snapshot round-trips state, log, ids and clock", () => {
    const src = makeCounter();
    tx(src.add, { by: 3 });
    tx(src.tag, { tag: "t" });
    const dst = makeCounter();
    const r = dst.c.restore(JSON.parse(JSON.stringify(src.c.snapshot())));
    expect(r.ok).toBe(true);
    expect(dst.c.get("n")).toBe(3);
    expect(dst.c.log()).toEqual(src.c.log());
    tx(dst.add, { by: 1 });
    const last = dst.c.log()[2];
    expect(last?.id).toBe(3);
    expect(last?.at).toBe(3);
  });

  it("restore keeps seq/tick at least their prior maximum", () => {
    const k = makeCounter();
    tx(k.add, { by: 1 });
    tx(k.add, { by: 1 });
    tx(k.add, { by: 1 });
    const empty = makeCounter().c.snapshot();
    expect(k.c.restore(empty).ok).toBe(true);
    tx(k.add, { by: 1 });
    expect(k.c.log()[0]?.id).toBe(4);
    expect(k.c.log()[0]?.at).toBe(4);
  });

  it("an entry whose payload fails its schema is rejected as schema.invalid", () => {
    const k = makeCounter();
    const r = k.c.restore({
      state: { n: 1, tags: [] },
      initial: { n: 0, tags: [] },
      log: [{ id: 1, name: "counter.tag", payload: { tag: 5 }, at: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    expect(k.c.log()).toHaveLength(0);
  });
});

describe("undo", () => {
  it("replays from base and returns false on an empty log", () => {
    const k = makeCounter();
    expect(k.c.undo()).toBe(false);
    tx(k.add, { by: 4 });
    expect(k.c.undo()).toBe(true);
    expect(k.c.get("n")).toBe(0);
    expect(k.c.undo()).toBe(false);
  });

  it("log() is reactive: commit and undo both notify", () => {
    const k = makeCounter();
    let seen = -1;
    scope(() => {
      effect(() => {
        seen = k.c.log().length;
      });
    });
    tx(k.add, { by: 1 });
    expect(seen).toBe(1);
    k.c.undo();
    expect(seen).toBe(0);
  });
});
