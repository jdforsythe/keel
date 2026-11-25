// std.workflows Crashes and replay: for generated crash points (a `close()` after a generated number of turns, then a
// new `createApp` on the same ctx), across every boundary of a step (before `attempt`, during `run`, before and after
// `done`), the step's effect is recorded once per entry: a restart is not an entry, so every run of one entry used one
// `key`, and the store's log holds one `done` entry per entry. The step's `done` leads back to its own state a generated
// number of times before it leaves, so each self-transition is a new entry with a new key. Seed 1337.
import { ok, s } from "@keel/schema";
import { commitStores, createApp, topology } from "@keel/server";
import { queue } from "@keel/std-jobs";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { flows, workflow } from "../src/index.server.ts";
import { type Sim, close, nextId, pass, settle, sim } from "./support.server.ts";

const turns = async (n: number) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

/** The removal chart whose `purged` leads back to `purging` until `loops` is 0. */
const loopChart = () =>
  chart(nextId("loopChart"), {
    data: s.object({
      n: s.int({ min: 0, max: 3 }),
      freed: s.int({ min: 0, max: 3 }),
      loops: s.int({ min: 0, max: 3 }),
    }),
    start: { n: 0, freed: 0, loops: 0 },
    events: { begin: s.object({}), purged: s.object({ freed: s.int({ min: 0, max: 3 }) }), stuck: s.object({}) },
    guards: { last: (d) => d.loops === 0 },
    actions: {
      record: (d, p) => ({ ...d, freed: p.freed }),
      again: (d) => ({ ...d, loops: Math.max(0, d.loops - 1) }),
    },
    initial: "queued",
    states: {
      queued: { on: { begin: "purging" } },
      purging: {
        on: {
          purged: [
            { to: "purged", guard: "last", do: "record" },
            { to: "purging", do: "again" },
          ],
          stuck: "stuck",
        },
      },
      purged: { final: true },
      stuck: { final: true },
    },
  });

test("Crashes at generated points of a looping step record each entry's effect once", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 6 }),
      fc.integer({ min: 0, max: 8 }),
      fc.integer({ min: 0, max: 3 }),
      async (crashes, slow, loops) => {
        const ctx: Sim = sim();
        const keys: string[] = [];
        const effects: string[] = [];
        const fid = nextId("crash");
        const wf = workflow(fid, {
          chart: loopChart(),
          steps: {
            purging: {
              run: async (data, _ctx, { key }) => {
                keys.push(key);
                await turns(slow);
                if (!effects.includes(key)) effects.push(key);
                return ok({ freed: data.n });
              },
              done: "purged",
              failed: "stuck",
              attempts: 10,
              timeoutMs: 5000,
            },
          },
        });
        const jobs = queue({ ...wf.jobs });
        const boot = () =>
          createApp({
            topology: topology({ web: { modules: ["api"], adapter: "node" } }),
            ctx,
            mode: "dev",
            runners: { api: [jobs, flows(jobs, [wf])] },
          });
        const id = ctx.random.id("Flow");
        let app = await boot();
        void (await commitStores(ctx, wf.stores, (S) => {
          void tx(S.start, { id, data: { n: 2, freed: 0, loops } });
          void tx(S.events.begin, { id, payload: {} });
          return ok(null);
        }));
        for (const at of crashes) {
          await turns(at);
          await close(app);
          app = await boot();
        }
        await settle();
        await pass(ctx, 130_000 * (loops + 1));
        const r = await commitStores(ctx, wf.stores, (S) =>
          ok({
            row: structuredClone(S.store.get("instances")[id]),
            done: S.store.log().filter((e) => e.name === `${fid}.purged`).length,
          }),
        );
        if (!r.ok) throw new Error(r.error.code);
        const { row, done } = r.value;
        const entries = Array.from({ length: loops + 1 }, (_, i) => `${id}:${fid}:${i + 1}`);
        expect(row?.state).toBe("purged");
        expect(row?.data.freed).toBe(2);
        expect(row?.entered).toBe(loops + 2);
        expect(done).toBe(loops + 1);
        expect([...new Set(keys)]).toEqual(entries);
        expect(effects).toEqual(entries);
        await close(app);
      },
    ),
    { seed: 1337, numRuns: 40 },
  );
});
