// Spec: k.model, clause "A three-member enum, a boolean and an integer with `min` 0 and `max` 2 payload field give 3 × 2 × 3 payloads in the declared order; an `s.string()` field with no `payloads` entry is E1710 and runs no edge."
// Seed: 1337.
// k.model, Rules "E1710 transactions of several stores or repeated names, a `from` or `payloads` value that fails its schema, a transaction with no finite domain (message names it: give `payloads`), or a closed form missing a transaction or starting from a store with log entries."
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import { explore } from "@keel/testing";
import { beforeEach, describe, expect, it } from "vitest";

// Every transaction here returns its state unchanged and records its payload, so one expanded state runs one edge
// per payload and the record is the domain order.
const seen: unknown[] = [];

const made = (() => {
  let out: ReturnType<typeof mk> | undefined;
  scope(
    () => {
      out = mk();
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const st = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: "dom.main" });
  invariant(st, (state) => state.n !== 5);
  const all = transaction(
    st,
    "dom.all",
    s.object({ kind: s.enum(["a", "b", "c"]), flag: s.boolean(), n: s.int({ min: 0, max: 2 }) }),
    (state, p) => {
      seen.push(p);
      return state;
    },
  );
  const kind = transaction(st, "dom.kind", s.object({ k: s.enum(["c", "a", "b"]) }), (state, p) => {
    seen.push(p.k);
    return state;
  });
  const flag = transaction(st, "dom.flag", s.object({ f: s.boolean() }), (state, p) => {
    seen.push(p.f);
    return state;
  });
  const int = transaction(st, "dom.int", s.object({ i: s.int({ min: 0, max: 2 }) }), (state, p) => {
    seen.push(p.i);
    return state;
  });
  const lit = transaction(st, "dom.lit", s.object({ l: s.literal("only") }), (state, p) => {
    seen.push(p.l);
    return state;
  });
  const opt = transaction(st, "dom.opt", s.object({ o: s.boolean().optional() }), (state, p) => {
    seen.push(p.o);
    return state;
  });
  const uni = transaction(
    st,
    "dom.uni",
    s.object({ u: s.union([s.literal("x"), s.literal(7), s.boolean()]) }),
    (state, p) => {
      seen.push(p.u);
      return state;
    },
  );
  const nested = transaction(
    st,
    "dom.nested",
    s.object({ inner: s.object({ z: s.boolean(), y: s.literal(1) }) }),
    (state, p) => {
      seen.push(p.inner);
      return state;
    },
  );
  const str = transaction(st, "dom.str", s.object({ text: s.string() }), (state, p) => {
    seen.push(p.text);
    return state;
  });
  const wide = transaction(st, "dom.wide", s.object({ w: s.int({ min: 0, max: 255 }) }), (state) => {
    seen.push("wide");
    return state;
  });
  const wider = transaction(st, "dom.wider", s.object({ w: s.int({ min: 0, max: 256 }) }), (state) => {
    seen.push("wider");
    return state;
  });
  const bump = transaction(st, "dom.bump", s.object({}), (state) => ({ n: Math.min(9, state.n + 1) }));

  // a second store with transactions of its own, and a tiny closed one
  const other = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: "dom.other" });
  const otherTx = transaction(other, "dom.otherTx", s.object({}), (state) => state);
  const tiny = store(s.object({ n: s.int({ min: 0, max: 2 }) }), { n: 0 }, { id: "dom.tiny" });
  const tinyBump = transaction(tiny, "dom.tinyBump", s.object({}), (state) => ({ n: Math.min(2, state.n + 1) }));
  const tinyReset = transaction(tiny, "dom.tinyReset", s.object({}), () => ({ n: 0 }));
  return {
    st,
    all,
    kind,
    flag,
    int,
    lit,
    opt,
    uni,
    nested,
    str,
    wide,
    wider,
    bump,
    other,
    otherTx,
    tiny,
    tinyBump,
    tinyReset,
  };
}
const m = made;

const thrownSync = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));

beforeEach(() => {
  seen.length = 0;
});

describe("k.model: payload domains", () => {
  it("an enum of three members, a boolean and an integer 0 to 2 give 18 payloads, all distinct, as edges from the start", () => {
    const r = explore([m.all], { from: { n: 0 }, depth: 1 });
    expect(r.edges).toBe(18);
    expect(seen).toHaveLength(18);
    expect(new Set(seen.map((p) => JSON.stringify(p))).size).toBe(18);
  });

  it("enum members come in declared order", () => {
    explore([m.kind], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual(["c", "a", "b"]);
  });

  it("false comes before true", () => {
    explore([m.flag], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual([false, true]);
  });

  it("integers with min 0 and max 2 ascend", () => {
    explore([m.int], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("a literal is one value", () => {
    explore([m.lit], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual(["only"]);
  });

  it("an absent optional comes first, then its values", () => {
    explore([m.opt], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual([undefined, false, true]);
  });

  it("union members come in declared order", () => {
    explore([m.uni], { from: { n: 0 }, depth: 1 });
    expect(seen).toEqual(["x", 7, false, true]);
  });

  it("a nested object of finite parts enumerates both of its fields", () => {
    explore([m.nested], { from: { n: 0 }, depth: 1 });
    expect(seen).toHaveLength(2);
    expect(new Set(seen.map((p) => JSON.stringify(p))).size).toBe(2);
  });

  it("a domain of 256 values is accepted", () => {
    const r = explore([m.wide], { from: { n: 0 }, depth: 1 });
    expect(r.edges).toBe(256);
  });

  it("a payloads entry replaces the schema's domain and runs in the order given", () => {
    explore([m.kind], { from: { n: 0 }, depth: 1, payloads: { "dom.kind": [{ k: "b" }, { k: "c" }] } });
    expect(seen).toEqual(["b", "c"]);
  });

  it("an s.string() field with no payloads entry is E1710 and runs no edge", () => {
    const e = thrownSync(() => explore([m.bump, m.str], { from: { n: 0 }, depth: 2 }));
    expect(codeOf(e)).toBe("E1710");
    expect(seen).toEqual([]);
  });

  it("an s.string() field with a payloads entry runs its payloads", () => {
    const r = explore([m.str], { from: { n: 0 }, depth: 1, payloads: { "dom.str": [{ text: "x" }, { text: "y" }] } });
    expect(r.edges).toBe(2);
    expect(seen).toEqual(["x", "y"]);
  });
});

describe("k.model: E1710", () => {
  it("transactions of several stores are E1710", () => {
    const e = thrownSync(() => explore([m.bump, m.otherTx], { from: { n: 0 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
  });

  it("repeated transaction names are E1710", () => {
    const e = thrownSync(() => explore([m.bump, m.bump], { from: { n: 0 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
  });

  it("a from that fails the store's schema is E1710", () => {
    const e = thrownSync(() => explore([m.bump], { from: { n: 99 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
  });

  it("a from that fails the store's invariants is E1710", () => {
    const e = thrownSync(() => explore([m.bump], { from: { n: 5 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
  });

  it("a payloads value that fails its schema is E1710 and runs no edge", () => {
    const e = thrownSync(() =>
      explore([m.int], { from: { n: 0 }, depth: 1, payloads: { "dom.int": [{ i: 1 }, { i: 99 }] } }),
    );
    expect(codeOf(e)).toBe("E1710");
    expect(seen).toEqual([]);
  });

  it("a transaction with no finite domain is E1710 and the message names it", () => {
    const e = thrownSync(() => explore([m.str], { from: { n: 0 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
    expect(messageOf(e)).toContain("dom.str");
    expect(messageOf(e)).toContain("payloads");
  });

  it("a domain of 257 values is not finite enough and is E1710", () => {
    const e = thrownSync(() => explore([m.wider], { from: { n: 0 }, depth: 1 }));
    expect(codeOf(e)).toBe("E1710");
    expect(messageOf(e)).toContain("dom.wider");
    expect(seen).toEqual([]);
  });

  it("a closed form missing a transaction of its store is E1710", () => {
    const e = thrownSync(() => explore([m.tinyBump]));
    expect(codeOf(e)).toBe("E1710");
  });

  it("a closed form starting from a store with log entries is E1710", () => {
    expect(tx(m.tinyBump, {}).ok).toBe(true);
    const e = thrownSync(() => explore([m.tinyBump, m.tinyReset]));
    expect(codeOf(e)).toBe("E1710");
    // the same store with `depth` is not a closed form and runs from its current state
    const r = explore([m.tinyBump, m.tinyReset], { depth: 1 });
    expect(r.states[0]).toEqual({ n: 1 });
  });
});
