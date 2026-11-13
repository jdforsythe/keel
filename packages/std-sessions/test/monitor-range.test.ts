// std.monitor: a save is counted over its own `from`..`head` range, so commits another process saved to a shared
// storage are not counted by this one.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { expect, test } from "vitest";
import { monitor } from "../src/monitor/index.ts";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

test("only the entries of this process's saves are counted", async () => {
  const map = new Map<string, string>();
  const base = createCtx({ mode: "sim", seed: 1337 });
  const ctx = {
    ...base,
    storage: {
      get: async (k: string) => map.get(k) ?? null,
      set: async (k: string, v: string) => void map.set(k, v),
    },
  };
  const entry = (id: number, name: string) => ({ id, name, payload: null, at: 0 });
  const ac = new AbortController();
  const done = monitor.run(ctx, ac.signal);
  // another process saved ids 1 and 2; this one saves id 3, then the other saves 4, then this one 5 and 6
  const log = [
    entry(1, "a.x"),
    entry(2, "a.x"),
    entry(3, "a.mine"),
    entry(4, "a.x"),
    entry(5, "a.mine"),
    entry(6, "a.y"),
  ];
  map.set("keel.store.a", JSON.stringify({ state: {}, initial: {}, head: 6, log }));
  report(ctx, { kind: "save", store: "a", from: 2, head: 3 });
  report(ctx, { kind: "save", store: "a", from: 4, head: 6 });
  await flush();
  ac.abort();
  await done;
  const tally: unknown = JSON.parse(map.get("sessions.tally") ?? "null");
  expect(Reflect.get(Object(tally), "tx")).toEqual({ "a.mine": 2, "a.y": 1 });
});
