// Spec: k.sync Conformance, "An entry's `base` and `key` survive `snapshot()`, a JSON round trip and `restore`."
// Seed 1337 (fast-check `seed: 1337`).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

/** Run `fn` in a scope with its own registry, so each store of one id lives apart (scope left open: callers use the stores after return). */
function isolated<T>(fn: () => T): T {
  const sc = scope(() => {});
  isolate(sc);
  return sc.run(fn);
}

function make() {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.bag" });
    const push = transaction(bag, "sync.push", Push, (state, { v }) => ({ items: [...state.items, v] }), {
      concurrent: "rebase",
    });
    return { bag, push };
  });
}

interface Step {
  v: number;
  base: number | undefined;
  key: string | undefined;
  meta: boolean;
}
const stepArb: fc.Arbitrary<Step> = fc.record({
  v: fc.integer({ min: -50, max: 50 }),
  base: fc.option(fc.nat({ max: 30 }), { nil: undefined }),
  key: fc.option(fc.stringMatching(/^[a-z0-9]{1,8}$/), { nil: undefined }),
  meta: fc.boolean(),
});

function drive(k: ReturnType<typeof make>, steps: readonly Step[]): void {
  let n = 0;
  for (const st of steps) {
    const options = {
      ...(st.base === undefined ? {} : { base: st.base }),
      ...(st.key === undefined ? {} : { key: `${st.key}-${n}` }),
      ...(st.meta ? { meta: { caller: "c" } } : {}),
    };
    tx(k.push, { v: st.v }, options);
    n += 1;
  }
}

function fields(k: ReturnType<typeof make>) {
  return k.bag.snapshot().log.map((e) => ({ id: e.id, base: e.base, key: e.key }));
}

describe("k.sync: entry fields", () => {
  it("an entry's `base` and `key` survive `snapshot()`", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 20 }), (steps) => {
        const k = make();
        drive(k, steps);
        const log = k.bag.log();
        const snap = k.bag.snapshot().log;
        expect(snap.map((e) => [e.id, e.base, e.key])).toEqual(log.map((e) => [e.id, e.base, e.key]));
        expect(log.some((e) => e.key !== undefined || e.base !== undefined)).toBe(
          steps.some((st) => st.key !== undefined || st.base !== undefined),
        );
      }),
      opts,
    );
  });

  it("an entry's `base` and `key` survive a JSON round trip", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 20 }), (steps) => {
        const k = make();
        drive(k, steps);
        const wire = JSON.parse(JSON.stringify(k.bag.snapshot()));
        expect(wire.log).toEqual(JSON.parse(JSON.stringify(k.bag.snapshot().log)));
        const dst = make();
        dst.bag.restore(wire);
        expect(fields(dst)).toEqual(fields(k));
      }),
      opts,
    );
  });

  it("an entry's `base` and `key` survive `restore`, and a restored `key` still deduplicates", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 20 }), (steps) => {
        const k = make();
        drive(k, steps);
        const dst = make();
        dst.bag.restore(k.bag.snapshot());
        expect(dst.bag.log().map((e) => [e.id, e.base, e.key])).toEqual(k.bag.log().map((e) => [e.id, e.base, e.key]));
        const keyed = dst.bag.log().find((e) => e.key !== undefined);
        if (keyed?.key !== undefined) {
          const head = dst.bag.head();
          expect(tx(dst.push, { v: 1 }, { key: keyed.key }).ok).toBe(true);
          expect(dst.bag.head()).toBe(head);
        }
      }),
      opts,
    );
  });

  it("`base` and `key` are entry fields, not `meta`: `snapshot({ meta: true })` meta holds neither", () => {
    const k = make();
    tx(k.push, { v: 1 }, { base: 4, key: "kk" });
    tx(k.push, { v: 2 }, { base: 9, key: "k2", meta: { caller: "c" } });
    const log = k.bag.snapshot({ meta: true }).log;
    expect(log[0]?.meta).toBeUndefined();
    expect(log[1]?.meta).toEqual({ caller: "c" });
    expect(log[0]?.base).toBe(4);
    expect(log[0]?.key).toBe("kk");
  });

  it("a write that is not concurrent keeps no `base`, so an entry holding `base` is a rebased write", () => {
    const k = make();
    tx(k.push, { v: 1 });
    tx(k.push, { v: 2 }, { base: k.bag.head() });
    tx(k.push, { v: 3 }, { base: 0 });
    expect(k.bag.log().map((e) => e.base)).toEqual([undefined, undefined, 0]);
  });
});
