// @vitest-environment happy-dom
// k.resume Stores and Nested islands: a `#k-state` snapshot with no store in `stores` restores the store of its id an
// island creates while it resumes. An island that mismatches (E1253) re-renders on the client; the store its
// re-render creates starts from that same served snapshot.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import { describe, expect, it } from "vitest";
import { clone, resume, template } from "../src/ops/index.ts";
import { testCtx } from "./testCtx.ts";

const Count = s.object({ n: s.number() });
const T = template('<div data-k-island="C"><p>x</p></div>');

/** The `#k-state` snapshot of a store of `id` at `{ n }`. */
const served = (id: string, n: number): unknown => {
  const out: { snap?: unknown } = {};
  scope(
    () => {
      out.snap = store(Count, { n }, { id }).snapshot();
    },
    { detached: true },
  ).dispose();
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
    const { warnings } = resume(page({ "waiting.mismatch": served("waiting.mismatch", 7) }), { C }, { ctx: testCtx });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="C"\]/);
    expect(seen).toEqual([7, 7]);
  });

  it("starts from initial when its schema refuses the snapshot, which resume reports E1253", () => {
    const seen: number[] = [];
    const C = (): Node => {
      const counter = store(Count, { n: 0 }, { id: "waiting.refused" });
      seen.push(counter.get("n"));
      return clone(T);
    };
    const { warnings } = resume(
      page({ "waiting.refused": { state: { n: "seven" }, log: [] } }),
      { C },
      { ctx: testCtx },
    );
    expect(seen).toEqual([0]);
    expect(warnings).toEqual(['E1253 #k-state snapshot for store "waiting.refused" does not restore']);
  });

  it("a store in `stores` that refuses its snapshot is an E1253 warning", () => {
    const out: { known?: { get: (k: "n") => number; restore: (snap: unknown) => unknown } } = {};
    scope(
      () => {
        out.known = store(Count, { n: 0 }, { id: "waiting.known" });
      },
      { detached: true },
    );
    const known = out.known;
    if (known === undefined) throw new Error("fixture: store scope did not run");
    const C = (): Node => clone(T);
    const host = page({ "waiting.known": { state: { n: "seven" }, log: [], initial: { n: 7 } } });
    const { warnings } = resume(host, { C }, { ctx: testCtx, stores: { "waiting.known": known } });
    expect(known.get("n")).toBe(0);
    expect(warnings).toEqual(['E1253 #k-state snapshot for store "waiting.known" does not restore']);
  });

  it("takes the snapshot once when the claim succeeds: no warning", () => {
    const seen: number[] = [];
    const C = (): Node => {
      const counter = store(Count, { n: 0 }, { id: "waiting.claimed" });
      seen.push(counter.get("n"));
      return clone(T);
    };
    const { warnings } = resume(page({ "waiting.claimed": served("waiting.claimed", 4) }), { C }, { ctx: testCtx });
    expect(warnings).toEqual([]);
    expect(seen).toEqual([4]);
  });
});
