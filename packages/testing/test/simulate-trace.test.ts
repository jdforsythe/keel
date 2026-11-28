// Spec: k.drive Law (the trace ends with the final value of each storage key the run wrote, then the snapshot of
// each live store by id, `{ kind: 'store', id, value }`). Seed: 1.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { type Store, store, transaction, tx } from "@keel/store";
import { simulate } from "@keel/testing";
import { describe, expect, it } from "vitest";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

async function thrown(run: () => Promise<unknown>): Promise<string[]> {
  try {
    await run();
  } catch (e) {
    return e instanceof Error ? e.message.split("\n") : [];
  }
  return [];
}

/** A live store `id` of one field `n` and the transaction that sets it, made in a scope that `done` ends. */
function made(id: string): {
  readonly st: Store<{ n: number }>;
  readonly set: (n: number) => void;
  readonly done: () => void;
} {
  let out: { st: Store<{ n: number }>; set: (n: number) => void } | undefined;
  const sc = scope(
    () => {
      const st = store(s.object({ n: s.int() }), { n: 0 }, { id });
      const t = transaction(st, `${id}.set`, s.object({ n: s.int() }), (_, p) => ({ n: p.n }));
      out = { st, set: (n) => void tx(t, { n }) };
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("no store");
  return { ...out, done: () => sc.dispose() };
}

describe("simulate trace: live stores", () => {
  it("a store that ends differently in two replays fails E1729 on its `store` entry, `{ kind, id, value }`", async () => {
    const { set, done } = made("trace.store");
    try {
      let calls = 0;
      const lines = await thrown(() =>
        simulate(
          async () => {
            calls += 1;
            set(calls);
          },
          { replay, law: true },
        ),
      );
      expect(lines[0]).toContain("E1729 two replays of the run differ at trace entry 0");
      expect(JSON.parse(lines[1] ?? "{}")).toMatchObject({ kind: "store", id: "trace.store" });
      expect(JSON.parse(lines[1] ?? "{}")).not.toEqual(JSON.parse(lines[2] ?? "{}"));
    } finally {
      done();
    }
  });

  it("storage entries come before store entries: a drifting key and a drifting store differ first at the key", async () => {
    const { set, done } = made("trace.order");
    try {
      let calls = 0;
      const lines = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            calls += 1;
            set(calls);
            await ctx.storage.set("k", String(calls));
          },
          { replay, law: true },
        ),
      );
      expect(lines[0]).toContain("trace entry 0");
      expect(lines[1]).toBe('{"kind":"storage","key":"k","value":"1"}');
    } finally {
      done();
    }
  });

  it("two replays that end alike pass, store snapshots included", async () => {
    const { st, set, done } = made("trace.same");
    try {
      await simulate(
        async ({ ctx }) => {
          set(5);
          await ctx.storage.set("k", "v");
        },
        { replay, law: true },
      );
      expect(st.get("n")).toBe(0);
    } finally {
      done();
    }
  });
});
