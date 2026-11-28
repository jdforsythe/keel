// @vitest-environment happy-dom
// k.testing, Properties "`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input."
// k.store, Log meta "`snapshot({ meta: true })` keeps it and `restore` keeps the `meta` of the entries it restores." (meta survives exactly when the log does)
// Seed: 1337 (rfc:0028, backlog 0104). properties() and a harness dispose must leave a store's log, with its meta, as they found it.
import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { clone, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import { properties, render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const Total = s.object({ total: s.int() });
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
  const st = store(Total, { total: 0 }, { id: "meta.total" });
  invariant(st, (state) => state.total >= 0);
  const add = transaction(st, "meta.add", s.object({ n: s.int() }), (state, { n }) => ({
    total: Math.min(1_000_000, Math.max(0, state.total + n)),
  }));
  return { st, add };
}
const { st, add } = made;

const T = template('<p id="meta.total.view"></p>');
const View = Object.assign(
  (_props: Record<string, never>): Node => {
    const root = clone(T);
    text(root, () => String(st.get("total")));
    return root;
  },
  { Props: s.object({}) },
);

const reset = (): void => {
  const r = st.restore({ state: { total: 0 }, log: [], initial: { total: 0 } });
  expect(r.ok).toBe(true);
};

describe("k.testing: properties and dispose keep the meta of the log entries they restore", () => {
  it("after properties(transaction) the store's snapshot({ meta: true }) deep-equals the one recorded before", async () => {
    reset();
    tx(add, { n: 5 }, { meta: { caller: "u1" } });
    const before = st.snapshot({ meta: true });
    expect(before.log[0]).toMatchObject({ meta: { caller: "u1" } });
    await properties(add, { runs: 25, seed: SEED });
    expect(st.snapshot({ meta: true })).toEqual(before);
    expect(st.snapshot({ meta: true }).log[0]).toMatchObject({ meta: { caller: "u1" } });
  });

  it("dispose of a render with state: [[store, value]] restores the store's log including its meta", () => {
    reset();
    tx(add, { n: 3 }, { meta: { caller: "u1" } });
    const before = st.snapshot({ meta: true });
    const t = render(View, { props: {}, state: [[st, { total: 7 }]], ctx: simCtx() });
    expect(t.state(st)).toEqual({ total: 7 });
    t.dispose();
    expect(st.snapshot({ meta: true })).toEqual(before);
    expect(st.snapshot({ meta: true }).log[0]).toMatchObject({ meta: { caller: "u1" } });
  });

  it("for any JSON meta record, properties() and a render/dispose leave snapshot({ meta: true }) unchanged", async () => {
    const key = fc.string({ minLength: 1, maxLength: 8 }).filter((k) => k !== "__proto__");
    const leaf = fc.oneof(fc.constant(null), fc.boolean(), fc.integer(), fc.string({ maxLength: 8 }));
    const value = fc.oneof(leaf, fc.array(leaf, { maxLength: 3 }), fc.dictionary(key, leaf, { maxKeys: 3 }));
    const metaArb = fc.dictionary(key, value, { maxKeys: 4 });
    await fc.assert(
      fc.asyncProperty(metaArb, fc.integer({ min: 0, max: 100 }), async (meta, n) => {
        reset();
        const r = tx(add, { n }, { meta });
        expect(r.ok).toBe(true);
        const before = st.snapshot({ meta: true });
        expect(before.log[0]).toMatchObject({ meta });
        await properties(add, { runs: 3, seed: SEED });
        expect(st.snapshot({ meta: true })).toEqual(before);
        const t = render(View, { props: {}, state: [[st, { total: n + 1 }]], ctx: simCtx() });
        t.dispose();
        expect(st.snapshot({ meta: true })).toEqual(before);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
