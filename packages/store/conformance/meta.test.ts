import { tx } from "@keel/store";
// k.store `tx` with `meta` logs it on the entry and leaves state as without it; non-JSON meta is `schema.invalid` and changes nothing; `snapshot()` entries carry no `meta`, and `restore(snapshot({ meta: true }))` reproduces the log with its meta. Seed 1337.
// Spec: k.store, clause "`tx` with `meta` logs it on the entry and leaves state as without it."
// Spec: k.store, clause "Non-JSON meta is `schema.invalid` and changes nothing."
// Spec: k.store, clause "`snapshot()` entries carry no `meta`, and `restore(snapshot({ meta: true }))` reproduces the log with its meta."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

const metaArb = fc.dictionary(
  fc.string({ maxLength: 6 }).filter((k) => k !== "__proto__"),
  fc.oneof(fc.string({ maxLength: 6 }), fc.integer(), fc.boolean(), fc.constant(null)),
  { maxKeys: 3 },
);
const stepArb = fc.record({ op: opArb, meta: fc.option(metaArb, { nil: undefined }) });

function run(
  k: ReturnType<typeof makeCart>,
  op: Parameters<typeof applyOp>[1],
  meta?: Record<string, string | number | boolean | null>,
) {
  if (meta === undefined) return applyOp(k, op);
  switch (op.kind) {
    case "add":
      return tx(k.add, { item: op.item }, { meta });
    case "pop":
      return tx(k.pop, {}, { meta });
    case "clear":
      return tx(k.clear, {}, { meta });
  }
}

describe("k.store: log meta", () => {
  it("`tx` with `meta` logs it on the entry and leaves state as without it", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 15 }), (steps) => {
        const withMeta = makeCart();
        const plain = makeCart();
        for (const st of steps) {
          run(withMeta, st.op, st.meta);
          applyOp(plain, st.op);
        }
        expect(withMeta.cart.snapshot().state).toEqual(plain.cart.snapshot().state);
        const log = withMeta.cart.log();
        expect(log.length).toBe(plain.cart.log().length);
        log.forEach((e, i) => {
          const given = steps[i]?.meta;
          if (given === undefined) expect("meta" in e).toBe(false);
          else expect(e.meta).toEqual(given);
        });
      }),
      opts,
    );
  });

  it("`tx` with `meta` logs it on the entry: the meta is copied and frozen", () => {
    const k = makeCart();
    const meta = { caller: "a" };
    tx(k.pop, {}, { meta });
    meta.caller = "b";
    const e = k.cart.log()[0];
    expect(e?.meta).toEqual({ caller: "a" });
    expect(Object.isFrozen(e?.meta)).toBe(true);
  });

  it("non-JSON meta is `schema.invalid` and changes nothing", () => {
    const bads = [
      { x: Number.NaN },
      { x: Number.POSITIVE_INFINITY },
      { x: { y: Number.NEGATIVE_INFINITY } },
      { x: [1, Number.NaN] },
    ];
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 8 }), fc.constantFrom(...bads), opArb, (ops, bad, op) => {
        const k = makeCart();
        for (const o of ops) applyOp(k, o);
        const before = JSON.stringify(k.cart.snapshot({ meta: true }));
        const r =
          op.kind === "add"
            ? tx(k.add, { item: op.item }, { meta: bad })
            : op.kind === "pop"
              ? tx(k.pop, {}, { meta: bad })
              : tx(k.clear, {}, { meta: bad });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("schema.invalid");
        expect(JSON.stringify(k.cart.snapshot({ meta: true }))).toBe(before);
      }),
      opts,
    );
  });

  it("non-JSON meta typed `unknown` at run time is `schema.invalid` and changes nothing", () => {
    const k = makeCart();
    const r = tx(k.pop, {}, { meta: { f: Number.NaN } });
    expect(r.ok).toBe(false);
    expect(k.cart.log()).toEqual([]);
  });

  it("`snapshot()` entries carry no `meta`", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 15 }), (steps) => {
        const k = makeCart();
        for (const st of steps) run(k, st.op, st.meta);
        for (const e of k.cart.snapshot().log) expect("meta" in e).toBe(false);
        for (const e of JSON.parse(JSON.stringify(k.cart.snapshot())).log) expect("meta" in e).toBe(false);
      }),
      opts,
    );
  });

  it("`restore(snapshot({ meta: true }))` reproduces the log with its meta", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 15 }), (steps) => {
        const src = makeCart();
        for (const st of steps) run(src, st.op, st.meta);
        const dst = makeCart();
        const r = dst.cart.restore(JSON.parse(JSON.stringify(src.cart.snapshot({ meta: true }))));
        expect(r.ok).toBe(true);
        expect(dst.cart.log()).toEqual(src.cart.log());
        expect(dst.cart.snapshot({ meta: true })).toEqual(src.cart.snapshot({ meta: true }));
      }),
      opts,
    );
  });

  it("`restore` of a snapshot without meta restores entries without meta", () => {
    const src = makeCart();
    run(src, { kind: "clear" }, { caller: "a" });
    const dst = makeCart();
    dst.cart.restore(JSON.parse(JSON.stringify(src.cart.snapshot())));
    expect(dst.cart.log().every((e) => !("meta" in e))).toBe(true);
  });
});
