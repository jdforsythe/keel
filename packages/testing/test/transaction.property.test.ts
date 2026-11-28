// Spec: k.testing Properties (transactions: generated state and payload; invariants). Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { properties } from "@keel/testing";
import { describe, expect, it } from "vitest";

const Counter = s.object({ n: s.int({ min: 0, max: 20 }) });
let made: { readonly counter: ReturnType<typeof make> } | undefined;
function make() {
  const counter = store(Counter, { n: 0 }, { id: "test.counter" });
  invariant(counter, (st) => st.n < 10);
  return counter;
}
scope(
  () => {
    made = { counter: make() };
  },
  { detached: true },
);
const counter = made?.counter;
if (counter === undefined) throw new Error("test: scope did not run");

// Valid states are 0..9 (generated 0..20, filtered by the invariant); addRaw breaks it only from state 9.
const addClamped = transaction(counter, "test.addClamped", s.object({ by: s.int() }), (st, { by }) => ({
  n: Math.min(9, st.n + Math.max(0, by)),
}));
const addRaw = transaction(counter, "test.addRaw", s.object({ by: s.int() }), (st, { by }) => ({
  n: by > 0 ? st.n + 1 : st.n,
}));

describe("properties(transaction) runs generated payloads from generated states", () => {
  it("a transaction keeping the invariant from every valid state passes; the store is left as it was", async () => {
    const before = counter.snapshot();
    expect(await properties(addClamped, { runs: 100, seed: 1337 })).toEqual({ seed: 1337, runs: 100 });
    expect(counter.snapshot()).toEqual(before);
  });

  it("a violation reachable only from a generated state reports the shrunk state and payload", async () => {
    const msg = await properties(addRaw, { runs: 200, seed: 1337 }).then(
      () => "",
      (e: unknown) => (e instanceof Error ? e.message : ""),
    );
    expect(msg).toMatch(/^E1704 test\.addRaw: invariant failed \(seed 1337, run \d+, shrunk\)/);
    expect(msg).toContain('payload: {"by":1}');
    expect(msg).toContain('state: {"n":9}');
    expect(counter.log()).toHaveLength(0);
  });
});
