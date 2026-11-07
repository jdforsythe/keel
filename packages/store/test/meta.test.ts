// Examples for RFC 0028: typed tx payloads, log entry meta, undoWhere. Not pinned by conformance in this detail.
import { scope } from "@keel/reactive";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type LogEntry, type LogMeta, type TxOptions, tx } from "../src/index.ts";
import { type Counter, makeCounter } from "./kit.ts";

// Whether some overload of `tx`, instantiated for the counter's `add`, accepts `Args` (as at a call site).
type AddTx = typeof tx<Counter, { by: number }>;
type Fits<Args extends unknown[]> = AddTx extends (...a: Args) => unknown ? true : false;

const hasMeta = (e: LogEntry | undefined): boolean => e !== undefined && Object.hasOwn(e, "meta");

describe("@keel/store typed tx", () => {
  it("payload is typed by the transaction's schema; unknown is accepted, a wrong type is not", () => {
    const k = makeCounter();
    type Add = typeof k.add;
    expectTypeOf<Fits<[Add, { by: number }]>>().toEqualTypeOf<true>();
    expectTypeOf<Fits<[Add, { by: number }, TxOptions]>>().toEqualTypeOf<true>();
    expectTypeOf<Fits<[Add, { by: string }]>>().toEqualTypeOf<false>();
    expectTypeOf<Fits<[Add, string | { by: number }]>>().toEqualTypeOf<false>();
    expectTypeOf<Fits<[Add, { tag: string }]>>().toEqualTypeOf<false>();
    expectTypeOf<Fits<[Add, { by: number }, { meta: { f: () => void } }]>>().toEqualTypeOf<false>();
    expectTypeOf<TxOptions["meta"]>().toEqualTypeOf<LogMeta | undefined>();
    // An `unknown` payload compiles (this call is type-checked) and is validated at run time.
    const raw: unknown = { by: 2 };
    expect(tx(k.add, raw).ok).toBe(true);
  });
});

describe("@keel/store log meta", () => {
  it("an entry has a meta key only when tx was given one", () => {
    const k = makeCounter();
    tx(k.add, { by: 1 });
    tx(k.add, { by: 1 }, {});
    tx(k.add, { by: 1 }, { meta: { caller: "a", n: [1, null, { ok: true }] } });
    const [a, b, c] = k.c.log();
    expect(hasMeta(a)).toBe(false);
    expect(hasMeta(b)).toBe(false);
    expect(c?.meta).toEqual({ caller: "a", n: [1, null, { ok: true }] });
    expect(k.c.snapshot().state.n).toBe(3);
  });

  it("meta is copied and frozen with its entry; the caller's object stays mutable", () => {
    const k = makeCounter();
    const meta = { caller: "a", list: ["x"] };
    tx(k.add, { by: 1 }, { meta });
    meta.caller = "b";
    meta.list.push("y");
    const e = k.c.log()[0];
    expect(e?.meta).toEqual({ caller: "a", list: ["x"] });
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e?.meta)).toBe(true);
    expect(Object.isFrozen(e?.meta?.list)).toBe(true);
    expect(Object.isFrozen(meta)).toBe(false);
  });

  it("non-JSON meta is schema.invalid at its path and commits nothing", () => {
    const k = makeCounter();
    tx(k.add, { by: 1 });
    const before = JSON.stringify([k.c.snapshot({ meta: true }), k.c.log()]);
    for (const bad of [{ x: Number.NaN }, { x: Number.POSITIVE_INFINITY }, { x: [Number.NaN] }]) {
      const r = tx(k.add, { by: 1 }, { meta: bad });
      expect(r.ok ? undefined : r.error.code).toBe("schema.invalid");
      if (!r.ok && r.error.code === "schema.invalid") expect(r.error.data.issues[0]?.path[0]).toBe("x");
    }
    expect(JSON.stringify([k.c.snapshot({ meta: true }), k.c.log()])).toBe(before);
  });

  it("payload is checked before meta, and meta before uses", () => {
    const k = makeCounter();
    const offSchema: unknown = { by: "x" };
    const both = tx(k.add, offSchema, { meta: { x: Number.NaN } });
    expect(both.ok || both.error.code !== "schema.invalid" ? undefined : both.error.data.issues[0]?.path).toEqual([
      "by",
    ]);
    let code: string | undefined;
    scope(() => {
      k.c.uses([k.tag]);
      const r = tx(k.add, { by: 1 }, { meta: { x: Number.NaN } });
      code = r.ok ? undefined : r.error.code;
    });
    expect(code).toBe("schema.invalid");
    expect(k.c.log()).toEqual([]);
  });

  it("snapshot() drops meta, snapshot({ meta: false }) too, snapshot({ meta: true }) keeps it", () => {
    const k = makeCounter();
    tx(k.add, { by: 1 }, { meta: { caller: "a" } });
    tx(k.tag, { tag: "t" });
    expect(k.c.snapshot().log.some(hasMeta)).toBe(false);
    expect(k.c.snapshot({ meta: false }).log.some(hasMeta)).toBe(false);
    expect(k.c.snapshot({ meta: true }).log.map((e) => e.meta)).toEqual([{ caller: "a" }, undefined]);
    expect(hasMeta(k.c.snapshot({ meta: true }).log[1])).toBe(false);
    expect(k.c.log()[0]?.meta).toEqual({ caller: "a" });
  });

  it("restore keeps the meta it is given, freezes restored entries, and rejects non-JSON meta", () => {
    const src = makeCounter();
    tx(src.add, { by: 1 }, { meta: { caller: "a" } });
    const dst = makeCounter();
    expect(dst.c.restore(JSON.parse(JSON.stringify(src.c.snapshot({ meta: true })))).ok).toBe(true);
    expect(dst.c.log()).toEqual(src.c.log());
    expect(Object.isFrozen(dst.c.log()[0])).toBe(true);
    expect(Object.isFrozen(dst.c.log()[0]?.meta)).toBe(true);
    expect(dst.c.restore(JSON.parse(JSON.stringify(src.c.snapshot()))).ok).toBe(true);
    expect(dst.c.log().some(hasMeta)).toBe(false);
    const bad = { ...src.c.snapshot(), log: [{ id: 1, name: "counter.add", payload: { by: 1 }, at: 1, meta: "a" }] };
    const before = JSON.stringify(dst.c.snapshot({ meta: true }));
    expect(dst.c.restore(bad).ok).toBe(false);
    expect(JSON.stringify(dst.c.snapshot({ meta: true }))).toBe(before);
  });
});

describe("@keel/store undoWhere", () => {
  it("is false on an empty log and never calls pred", () => {
    const k = makeCounter();
    const seen: LogEntry[] = [];
    expect(
      k.c.undoWhere((e) => {
        seen.push(e);
        return true;
      }),
    ).toBe(false);
    expect(seen).toEqual([]);
  });

  it("asks pred about the latest entry only and undoes it when pred holds", () => {
    const k = makeCounter();
    tx(k.add, { by: 1 }, { meta: { caller: "a" } });
    tx(k.add, { by: 2 }, { meta: { caller: "b" } });
    const seen: unknown[] = [];
    const mine = (e: LogEntry): boolean => {
      seen.push(e.meta?.caller);
      return e.meta?.caller === "a";
    };
    expect(k.c.undoWhere(mine)).toBe(false);
    expect(seen).toEqual(["b"]);
    expect(k.c.get("n")).toBe(3);
    expect(k.c.log().length).toBe(2);
    expect(k.c.undoWhere((e) => e.meta?.caller === "b")).toBe(true);
    expect(k.c.get("n")).toBe(1);
    expect(k.c.undoWhere(mine)).toBe(true);
    expect(k.c.get("n")).toBe(0);
    expect(k.c.log()).toEqual([]);
  });

  it("undo is unchanged: it ignores meta", () => {
    const k = makeCounter();
    tx(k.add, { by: 5 }, { meta: { caller: "a" } });
    expect(k.c.undo()).toBe(true);
    expect(k.c.undo()).toBe(false);
    expect(k.c.get("n")).toBe(0);
  });
});
