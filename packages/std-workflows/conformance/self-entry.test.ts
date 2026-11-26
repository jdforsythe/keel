// std.workflows, Store "a taken target with a `to`, its own state too, raises `entered` by one"
// Seed: 1337.
// Assumption: as in fixtures.ts; the instance row is read through `commitStores`. A step state whose `done` event's target leads back to the state itself (guarded by a count in `data`) runs `run` on each entry; the entry count `entered` starts at a value the spec does not fix, so keys and rows are compared with the `entered` read after `begin`.
// Assumption: a target with no `to` (`{ do }` alone) is the chart's "stay", which applies `do` and leaves the state, so `entered` stays.
import { fixedTime } from "@keel/tooling/test-time";
import { ok, s } from "@keel/schema";
import { commitStores, createApp, topology } from "@keel/server";
import { queue } from "@keel/std-jobs";
import { chart } from "@keel/std-statecharts";
import { flows, workflow } from "@keel/std-workflows";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { close, nextId, pass, sim } from "./fixtures.ts";

const none = s.object({});
const Data = s.object({ n: s.int({ min: 0, max: 10 }) });

/** `loop` is a step state; `again` leads back to `loop` while `n < limit`, then to `done`; `stay` has no `to`. */
const loopFlow = (limit: number, keys: string[]) => {
  const id = nextId("selfEntry");
  const c = chart(nextId("selfEntryChart"), {
    data: Data,
    start: { n: 0 },
    events: { begin: none, again: none, stay: none, stuck: s.object({ code: s.string() }) },
    guards: { more: (d) => d.n < limit },
    actions: { bump: (d) => ({ n: d.n + 1 }) },
    initial: "queued",
    states: {
      queued: { on: { begin: "loop" } },
      loop: {
        on: {
          again: [{ to: "loop", guard: "more", do: "bump" }, { to: "done" }],
          stay: { do: "bump" },
          stuck: "failed",
        },
      },
      done: { final: true },
      failed: { final: true },
    },
  });
  const wf = workflow(id, {
    chart: c,
    steps: {
      loop: {
        run: async (_data, _ctx, env) => {
          keys.push(env.key);
          return ok({});
        },
        done: "again",
        failed: "stuck",
        attempts: 3,
        timeoutMs: 60_000,
      },
    },
    waits: {},
  });
  const jobs = queue({ ...wf.jobs });
  return { id, wf, jobs };
};
type Loop = ReturnType<typeof loopFlow>;

const readRow = async (ctx: ReturnType<typeof sim>, f: Loop, id: string) => {
  const out: { state: string; entered: number; attempt: number; n: number }[] = [];
  const r = await commitStores(ctx, f.wf.stores, (S) => {
    const row = structuredClone(S.store.snapshot().state.instances[id]);
    if (row !== undefined) out.push({ state: row.state, entered: row.entered, attempt: row.attempt, n: row.data.n });
    return ok(null);
  });
  if (!r.ok) throw new Error(`commitStores failed: ${r.error.code}`);
  const row = out[0];
  if (row === undefined) throw new Error("instance missing");
  return row;
};

const begin = async (ctx: ReturnType<typeof sim>, f: Loop, id: string) => {
  const r = await commitStores(ctx, f.wf.stores, (S) => {
    tx(S.start, { id, data: { n: 0 } });
    tx(S.events.begin, { id, payload: {} });
    return ok(null);
  });
  if (!r.ok) throw new Error(`commitStores failed: ${r.error.code}`);
  return (await readRow(ctx, f, id)).entered;
};

test(
  "a step state whose `done` event's target leads back to its own state runs again on each entry with a new `key` (`<id>:<flow>:<entered>`, `entered` one higher each time) until an event leads elsewhere",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (limit) => {
        const ctx = sim();
        const keys: string[] = [];
        const f = loopFlow(limit, keys);
        const app = await createApp({
          topology: topology({ web: { modules: ["api"], adapter: "node" } }),
          ctx,
          mode: "dev",
          runners: { api: [f.jobs, flows(f.jobs, [f.wf])] },
        });
        const id = ctx.random.id("Flow");
        const first = await begin(ctx, f, id);
        await pass(ctx, 5000);
        expect(keys).toEqual(Array.from({ length: limit + 1 }, (_, i) => `${id}:${f.id}:${first + i}`));
        const row = await readRow(ctx, f, id);
        expect(row.state).toBe("done");
        expect(row.n).toBe(limit);
        expect(row.entered).toBe(first + limit + 1);
        await close(app);
      }),
      { seed: 1337, numRuns: 4 },
    );
  },
  fixedTime(60_000),
);

test(
  "a target with no `to` leaves `entered` unchanged",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (stays) => {
        const ctx = sim();
        const f = loopFlow(0, []);
        const id = ctx.random.id("Flow");
        const first = await begin(ctx, f, id);
        for (let i = 0; i < stays; i++) {
          const r = await commitStores(ctx, f.wf.stores, (S) => {
            tx(S.events.stay, { id, payload: {} });
            return ok(null);
          });
          if (!r.ok) throw new Error(`commitStores failed: ${r.error.code}`);
        }
        const row = await readRow(ctx, f, id);
        expect(row.state).toBe("loop");
        expect(row.n).toBe(stays);
        expect(row.entered).toBe(first);
      }),
      { seed: 1337, numRuns: 5 },
    );
  },
  fixedTime(60_000),
);
