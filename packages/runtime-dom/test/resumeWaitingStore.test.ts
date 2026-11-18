// @vitest-environment happy-dom
// k.resume Stores and Nested islands: a `#k-state` snapshot with no store in `stores` restores the store of its id an
// island creates while it resumes. An island that mismatches (E1253) re-renders on the client; the store its
// re-render creates starts from that same served snapshot.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import { describe, expect, it } from "vitest";
import { clone, resume, template } from "../src/ops/index.ts";

const Count = s.object({ n: s.number() });
const T = template('<div data-k-island="C"><p>x</p></div>');

/** The `#k-state` snapshot of a store of `id` at `{ n }`. */
const served = (id: string, n: number): unknown => {
  const out: { snap?: unknown } = {};
  scope(() => {
    out.snap = store(Count, { n }, { id }).snapshot();
  }).dispose();
  return out.snap;
};

const page = (stores: Record<string, unknown>): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = `<div data-k-island="C"><p>x</p></div><script type="application/json" id="k-state">${JSON.stringify({ stores, islands: { C: {} } })}</script>`;
  return host;
};

describe("a store an island creates while it resumes", () => {
  it("starts from the served snapshot in the client re-render after the claim mismatched", () => {
    const seen: number[] = [];
    let calls = 0;
    const C = (): Node => {
      const counter = store(Count, { n: 0 }, { id: "waiting.mismatch" });
      seen.push(counter.get("n"));
      calls++;
      if (calls === 1) throw new Error("claim fails");
      return clone(T);
    };
    const { warnings } = resume(page({ "waiting.mismatch": served("waiting.mismatch", 7) }), { C });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="C"\]/);
    expect(seen).toEqual([7, 7]);
  });

  it("takes the snapshot once when the claim succeeds: no warning", () => {
    const seen: number[] = [];
    const C = (): Node => {
      const counter = store(Count, { n: 0 }, { id: "waiting.claimed" });
      seen.push(counter.get("n"));
      return clone(T);
    };
    const { warnings } = resume(page({ "waiting.claimed": served("waiting.claimed", 4) }), { C });
    expect(warnings).toEqual([]);
    expect(seen).toEqual([4]);
  });
});
