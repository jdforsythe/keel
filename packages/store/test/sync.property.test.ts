// Properties for heads, `base`, `key` and `concurrent` over generated write sequences. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { invariant, store, transaction, tx } from "../src/index.ts";
import { opts } from "./kit.ts";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const CAP = 8;

function make(concurrent: "reject" | "rebase", logLimit?: number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const bag = store(Bag, { items: [] }, logLimit === undefined ? {} : { logLimit });
    const push = transaction(bag, "bag.push", Push, (st, { v }) => ({ items: [...st.items, v] }), { concurrent });
    invariant(bag, (st) => st.items.length <= CAP);
    return { bag, push };
  };
  const sc = scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}

type Kit = ReturnType<typeof make>;

type Step =
  | { kind: "push"; v: number; base: number | undefined; key: string | undefined }
  | { kind: "undo" }
  | { kind: "undoWhere"; yes: boolean };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("push" as const),
      v: fc.integer({ min: -9, max: 9 }),
      base: fc.option(fc.nat({ max: 12 }), { nil: undefined }),
      key: fc.option(fc.constantFrom("a", "b", "c", "d"), { nil: undefined }),
    }),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "undo" }) },
  { weight: 1, arbitrary: fc.boolean().map((yes): Step => ({ kind: "undoWhere", yes })) },
);
const modeArb = fc.constantFrom<"reject" | "rebase">("reject", "rebase");

/** Run one step; true when the store changed (a commit or an undo that undid). */
function step(k: Kit, st: Step): boolean {
  if (st.kind === "undo") return k.bag.undo();
  if (st.kind === "undoWhere") return k.bag.undoWhere(() => st.yes);
  const before = k.bag.log().at(-1);
  const r = tx(
    k.push,
    { v: st.v },
    { ...(st.base === undefined ? {} : { base: st.base }), ...(st.key === undefined ? {} : { key: st.key }) },
  );
  return r.ok && k.bag.log().at(-1) !== before;
}

describe("@keel/store sync properties", () => {
  it("head() is monotonic: it rises by one exactly when a step changes the store, and each new entry's id is the head", () => {
    fc.assert(
      fc.property(modeArb, fc.array(stepArb, { maxLength: 40 }), (mode, steps) => {
        const k = make(mode);
        let expected = 0;
        for (const st of steps) {
          const changed = step(k, st);
          if (changed) expected += 1;
          expect(k.bag.head()).toBe(expected);
          if (changed && st.kind === "push") expect(k.bag.log().at(-1)?.id).toBe(expected);
        }
        const ids = k.bag.log().map((e) => e.id);
        expect([...ids].sort((a, b) => a - b)).toEqual(ids);
        expect(new Set(ids).size).toBe(ids.length);
        k.dispose();
      }),
      opts,
    );
  });

  it("key idempotence: a write whose key `keys` holds for its transaction returns ok and changes nothing, whatever its base", () => {
    fc.assert(
      fc.property(
        modeArb,
        fc.array(stepArb, { maxLength: 20 }),
        fc.constantFrom("a", "b", "c", "d"),
        fc.option(fc.nat({ max: 12 }), { nil: undefined }),
        (mode, steps, key, base) => {
          const k = make(mode);
          for (const st of steps) step(k, st);
          const held = k.bag.snapshot().keys.some((p) => p.name === "bag.push" && p.key === key);
          const before = JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.head()]);
          const r = tx(k.push, { v: 1 }, base === undefined ? { key } : { key, base });
          if (held) {
            expect(r.ok).toBe(true);
            expect(JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.head()])).toBe(before);
          } else if (r.ok) expect(k.bag.log().at(-1)?.key).toBe(key);
          k.dispose();
        },
      ),
      opts,
    );
  });

  it("keys is the model: the latest logLimit keyed commits, oldest first, whatever undo and folding do", () => {
    fc.assert(
      fc.property(
        modeArb,
        fc.array(stepArb, { maxLength: 40 }),
        fc.option(fc.nat({ max: 4 }), { nil: undefined }),
        (mode, steps, limit) => {
          const k = make(mode, limit);
          const cap = limit ?? 256;
          let model: string[] = [];
          for (const st of steps) {
            const held = st.kind === "push" && st.key !== undefined && model.includes(st.key);
            const head = k.bag.head();
            const changed = step(k, st);
            if (held) expect(k.bag.head()).toBe(head);
            if (changed && st.kind === "push" && st.key !== undefined) model = [...model, st.key].slice(-cap);
            if (cap === 0) model = [];
            expect(k.bag.snapshot().keys).toEqual(model.map((key) => ({ name: "bag.push", key })));
          }
          const dst = make(mode, limit);
          expect(dst.bag.restore(JSON.parse(JSON.stringify(k.bag.snapshot()))).ok).toBe(true);
          expect(dst.bag.snapshot().keys).toEqual(k.bag.snapshot().keys);
          k.dispose();
          dst.dispose();
        },
      ),
      opts,
    );
  });

  it("rebase equals applying on the current state: same state and outcome as the write without base", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -9, max: 9 }), { maxLength: CAP + 2 }),
        fc.integer({ min: -9, max: 9 }),
        fc.nat({ max: 20 }),
        (prior, v, base) => {
          const a = make("rebase");
          const b = make("rebase");
          for (const p of prior) {
            tx(a.push, { v: p });
            tx(b.push, { v: p });
          }
          const ra = tx(a.push, { v }, { base });
          const rb = tx(b.push, { v });
          expect(ra.ok).toBe(rb.ok);
          expect(a.bag.snapshot().state).toEqual(b.bag.snapshot().state);
          expect(a.bag.head()).toBe(b.bag.head());
          const entry = a.bag.log().at(-1);
          if (ra.ok) expect(entry?.base).toBe(base === a.bag.head() - 1 ? undefined : base);
          a.dispose();
          b.dispose();
        },
      ),
      opts,
    );
  });

  it("reject refuses exactly the writes whose base is not head(), with the head in the error", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 20 }), fc.nat({ max: 20 }), (steps, base) => {
        const k = make("reject");
        for (const st of steps) step(k, st);
        const head = k.bag.head();
        const full = k.bag.get("items").length >= CAP;
        const r = tx(k.push, { v: 0 }, { base });
        if (base !== head) {
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.error).toMatchObject({ code: "keel.conflict", data: { base, head } });
          expect(k.bag.head()).toBe(head);
        } else expect(r.ok).toBe(!full);
        k.dispose();
      }),
      opts,
    );
  });

  it("snapshot and restore round trip keeps head, base and key, also through JSON and a smaller logLimit", () => {
    fc.assert(
      fc.property(
        modeArb,
        fc.array(stepArb, { maxLength: 30 }),
        fc.option(fc.nat({ max: 4 }), { nil: undefined }),
        (mode, steps, limit) => {
          const src = make(mode);
          for (const st of steps) step(src, st);
          const snap = JSON.parse(JSON.stringify(src.bag.snapshot()));
          const dst = make(mode, limit);
          expect(dst.bag.restore(snap).ok).toBe(true);
          expect(dst.bag.head()).toBe(src.bag.head());
          const fields = (k: Kit) => k.bag.log().map((e) => [e.id, e.base, e.key]);
          const kept = fields(src);
          expect(fields(dst)).toEqual(limit === undefined ? kept : kept.slice(Math.max(0, kept.length - limit)));
          expect(dst.bag.snapshot().head).toBe(src.bag.head());
          src.dispose();
          dst.dispose();
        },
      ),
      opts,
    );
  });

  it("restoring a snapshot the store produced sets head() to its head, and the next commit's id is head + 1", () => {
    fc.assert(
      fc.property(modeArb, fc.array(stepArb, { maxLength: 30 }), (mode, steps) => {
        const src = make(mode);
        for (const st of steps) step(src, st);
        const snap = src.bag.snapshot();
        const dst = make(mode);
        tx(dst.push, { v: 0 });
        expect(dst.bag.restore(snap).ok).toBe(true);
        expect(dst.bag.head()).toBe(snap.head);
        const r = tx(dst.push, { v: 0 });
        if (r.ok) expect(dst.bag.log().at(-1)?.id).toBe(snap.head + 1);
        else expect(dst.bag.get("items").length).toBe(CAP);
        src.dispose();
        dst.dispose();
      }),
      opts,
    );
  });
});

describe("@keel/store sync examples", () => {
  it("a transaction exposes concurrent, 'reject' by default; an unknown value throws", () => {
    const k = make("rebase");
    expect(k.push.concurrent).toBe("rebase");
    scope(() => {
      const other = store(Bag, { items: [] });
      expect(transaction(other, "bag.a", Push, (st) => st).concurrent).toBe("reject");
      // JSON.parse yields untyped options, standing in for a caller that bypasses the types.
      expect(() => transaction(other, "bag.b", Push, (st) => st, JSON.parse('{"concurrent":"merge"}'))).toThrow(
        /concurrent merge/,
      );
    }).dispose();
    k.dispose();
  });

  it("an undo raises the head and leaves a gap in ids; restore without head uses the latest id, else 0", () => {
    const k = make("reject");
    tx(k.push, { v: 1 });
    tx(k.push, { v: 2 });
    expect(k.bag.undo()).toBe(true);
    expect(k.bag.undo()).toBe(true);
    expect(k.bag.undo()).toBe(false);
    expect(k.bag.head()).toBe(4);
    tx(k.push, { v: 3 });
    expect(k.bag.log().map((e) => e.id)).toEqual([5]);
    const { head: _head, ...headless } = k.bag.snapshot();
    const dst = make("reject");
    expect(dst.bag.restore(headless).ok).toBe(true);
    expect(dst.bag.head()).toBe(5);
    expect(dst.bag.restore({ ...headless, log: [] }).ok).toBe(true);
    expect(dst.bag.head()).toBe(0);
    k.dispose();
    dst.dispose();
  });

  it("a snapshot head that is not a non-negative integer is schema.invalid and changes nothing", () => {
    const k = make("reject");
    tx(k.push, { v: 1 });
    for (const head of [-1, 1.5, "2", null]) {
      const r = k.bag.restore({ ...k.bag.snapshot(), head });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
      expect(k.bag.head()).toBe(1);
    }
    k.dispose();
  });

  it("a snapshot whose head is below its latest entry's id is schema.invalid and changes nothing", () => {
    const k = make("reject");
    for (const v of [1, 2, 3]) tx(k.push, { v });
    const dst = make("reject");
    tx(dst.push, { v: 9 });
    const snap = k.bag.snapshot();
    for (const head of [0, 1, 2]) {
      const r = dst.bag.restore({ ...snap, head });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
      expect(dst.bag.head()).toBe(1);
      expect(dst.bag.get("items")).toEqual([9]);
    }
    expect(tx(dst.push, { v: 4 }).ok).toBe(true);
    expect(dst.bag.log().map((e) => e.id)).toEqual([1, 2]);
    expect(dst.bag.restore({ ...snap, head: 3 }).ok).toBe(true);
    expect(dst.bag.restore({ ...snap, head: 7 }).ok).toBe(true);
    expect(dst.bag.head()).toBe(7);
    k.dispose();
    dst.dispose();
  });

  it("restore may lower a live store's head: it sets the head of any valid snapshot", () => {
    const k = make("reject");
    tx(k.push, { v: 1 });
    const older = k.bag.snapshot();
    for (const v of [2, 3, 4]) tx(k.push, { v });
    expect(k.bag.head()).toBe(4);
    expect(k.bag.restore(older).ok).toBe(true);
    expect(k.bag.head()).toBe(1);
    expect(tx(k.push, { v: 5 }, { base: 1 }).ok).toBe(true);
    expect(k.bag.log().map((e) => e.id)).toEqual([1, 2]);
    k.dispose();
  });

  it("a key outside 1 to 64 characters and a negative or fractional base are schema.invalid", () => {
    const k = make("rebase");
    for (const options of [{ key: "" }, { key: "x".repeat(65) }, { base: -1 }, { base: 1.5 }]) {
      const r = tx(k.push, { v: 1 }, options);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    }
    expect(tx(k.push, { v: 1 }, { key: "x".repeat(64) }).ok).toBe(true);
    expect(k.bag.head()).toBe(1);
    k.dispose();
  });

  it("an undeclared transaction is store.undeclared even when its key is held", () => {
    const k = make("reject");
    tx(k.push, { v: 1 }, { key: "k" });
    scope(() => {
      k.bag.uses([]);
      const r = tx(k.push, { v: 2 }, { key: "k" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("store.undeclared");
    }).dispose();
    k.dispose();
  });

  it("head() is reactive", () => {
    const k = make("reject");
    const seen: number[] = [];
    const sc = scope(() => {
      const h = k.bag.select(() => k.bag.head());
      seen.push(h.get());
      tx(k.push, { v: 1 });
      seen.push(h.get());
    });
    expect(seen).toEqual([0, 1]);
    sc.dispose();
    k.dispose();
  });
});
