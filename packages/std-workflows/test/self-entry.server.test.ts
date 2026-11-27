// std.workflows Store and Run: every target the chart takes that names a `to`, the instance's own state included, is an
// entry: `entered` rises and `attempt` resets, so a step or wait that leads back to its own state gets a new job key and
// runs again, each run's effect recorded once. A target with no `to`, or a guarded one the chart does not take, stays in
// the entry. Seed 1337.
import { ok, s } from "@keel/schema";
import { commitStores, createApp, topology } from "@keel/server";
import { queue } from "@keel/std-jobs";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { flows, workflow } from "../src/index.server.ts";
import { type Sim, close, inRoot, nextId, pass, sim } from "./support.server.ts";

const empty = s.object({});

/** A polling chart: `polling` is a step state, `sleeping` a wait state; each loops back to itself until `n` is `max`. */
const pollChart = () =>
  inRoot(() =>
    chart(nextId("pollChart"), {
      data: s.object({ n: s.int({ min: 0, max: 20 }), max: s.int({ min: 1, max: 20 }), marks: s.int({ min: 0 }) }),
      start: { n: 0, max: 1, marks: 0 },
      events: {
        go: empty,
        nap: empty,
        tick: empty,
        again: s.object({ last: s.boolean() }),
        wake: empty,
        note: empty,
        probe: empty,
        stuck: s.object({ code: s.string() }),
      },
      guards: { last: (d) => d.n + 1 >= d.max, said: (_d, p) => p.last, never: () => false },
      actions: { inc: (d) => ({ ...d, n: d.n + 1 }), mark: (d) => ({ ...d, marks: d.marks + 1 }) },
      initial: "idle",
      states: {
        idle: { on: { go: "polling", nap: "sleeping" } },
        polling: {
          on: {
            tick: [
              { to: "done", guard: "last", do: "inc" },
              { to: "polling", do: "inc" },
            ],
            again: [{ to: "done", guard: "said" }, "polling"],
            note: { do: "mark" },
            probe: { to: "polling", guard: "never" },
            stuck: "stuck",
          },
        },
        sleeping: {
          on: {
            wake: [
              { to: "done", guard: "last", do: "inc" },
              { to: "sleeping", do: "inc" },
            ],
          },
        },
        done: { final: true },
        stuck: { final: true },
      },
    }),
  );

type Done = "tick" | "again";
function makePoll(done: Done, max: number) {
  const id = nextId("poll");
  const keys: string[] = [];
  let runs = 0;
  const ran = (key: string): number => {
    keys.push(key);
    runs += 1;
    return runs;
  };
  const wf = inRoot(() =>
    workflow(id, {
      chart: pollChart(),
      steps: {
        // Each `done` event takes its own payload: `tick` `{}`, `again` `{ last }`.
        polling:
          done === "tick"
            ? {
                run: async (_data, _ctx, { key }) => {
                  ran(key);
                  return ok({});
                },
                done: "tick",
                failed: "stuck",
              }
            : { run: async (_data, _ctx, { key }) => ok({ last: ran(key) >= max }), done: "again", failed: "stuck" },
      },
      waits: { sleeping: { ms: 1000, event: "wake" } },
    }),
  );
  return { id, wf, jobs: queue({ ...wf.jobs }), keys };
}
type Poll = ReturnType<typeof makePoll>;

async function launch(ctx: Sim, f: Poll, first: "go" | "nap", max: number) {
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { api: [f.jobs, flows(f.jobs, [f.wf])] },
  });
  const id = ctx.random.id("Flow");
  void (await commitStores(ctx, f.wf.stores, (S) => {
    void tx(S.start, { id, data: { n: 0, max, marks: 0 } });
    void tx(S.events[first], { id, payload: {} });
    return ok(null);
  }));
  return { app, id };
}

async function read(ctx: Sim, f: Poll, id: string, event: string) {
  const r = await commitStores(ctx, f.wf.stores, (S) =>
    ok({
      row: structuredClone(S.store.get("instances")[id]),
      logged: S.store.log().filter((e) => e.name === `${f.id}.${event}`).length,
    }),
  );
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

test("A step whose done leads back to its own state runs once per entry, then leaves", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.constantFrom<Done>("tick", "again"), async (max, done) => {
      const ctx = sim();
      const f = makePoll(done, max);
      const { app, id } = await launch(ctx, f, "go", max);
      await pass(ctx, 20_000);
      const { row, logged } = await read(ctx, f, id, done);
      expect(row?.state).toBe("done");
      expect(f.keys).toEqual(Array.from({ length: max }, (_, i) => `${id}:${f.id}:${i + 1}`));
      expect(logged).toBe(max);
      expect(row?.entered).toBe(max + 1);
      expect(row?.attempt).toBe(0);
      if (done === "tick") expect(row?.data.n).toBe(max);
      await close(app);
    }),
    { seed: 1337, numRuns: 12 },
  );
});

test("A wait whose event leads back to its own state waits again, then leaves", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (max) => {
      const ctx = sim();
      const f = makePoll("tick", max);
      const { app, id } = await launch(ctx, f, "nap", max);
      await pass(ctx, 500, 100);
      expect((await read(ctx, f, id, "wake")).logged).toBe(0);
      await pass(ctx, 70_000);
      const { row, logged } = await read(ctx, f, id, "wake");
      expect(row?.state).toBe("done");
      expect(row?.data.n).toBe(max);
      expect(logged).toBe(max);
      expect(row?.entered).toBe(max + 1);
      expect(f.keys).toEqual([]);
      await close(app);
    }),
    { seed: 1337, numRuns: 5 },
  );
});

test("A target with no `to`, or a guarded self target not taken, stays in the entry", async () => {
  const f = makePoll("tick", 3);
  const ctx = sim();
  const r = await commitStores(ctx, f.wf.stores, (S) => {
    const id = "f1";
    void tx(S.start, { id, data: { n: 0, max: 3, marks: 0 } });
    void tx(S.events.go, { id, payload: {} });
    void tx(S.attempt, { id, entered: 1 });
    const at = () => structuredClone(S.store.get("instances")[id]);
    const before = at();
    void tx(S.events.note, { id, payload: {} });
    const noted = at();
    void tx(S.events.probe, { id, payload: {} });
    const probed = at();
    void tx(S.events.tick, { id, payload: {} });
    return ok({ before, noted, probed, ticked: at() });
  });
  if (!r.ok) throw new Error(r.error.code);
  const { before, noted, probed, ticked } = r.value;
  expect(before).toMatchObject({ state: "polling", entered: 1, attempt: 1 });
  expect(noted).toMatchObject({ state: "polling", entered: 1, attempt: 1, data: { marks: 1 } });
  expect(probed).toEqual(noted);
  expect(ticked).toMatchObject({ state: "polling", entered: 2, attempt: 0, data: { n: 1 } });
});
