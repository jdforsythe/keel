// Shared fixtures for the package tests (not a test file); the conformance files keep their own copy.
// Assumption: `removal.stores(ctx)` returns `{ store, start, events }` (the chart's shape plus `start`, `attempt`, `forget`), so `S.start`, `S.events.undo` and `S.store` are the spec's `s.removal.start`, `s.removal.events.undo`.
// Assumption: `workflow(...)` returns `{ stores, jobs }` and `flows(queue, [workflow])` is built from it, as in the spec's example.
// Assumption: `<flow>` in the step key `<id>:<flow>:<entered>` is the workflow's id.
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners.
import { type SimCtx, createCtx } from "@keel/ctx";
import { type KeelError, type Result, s } from "@keel/schema";
import { ok } from "@keel/schema";
import { commitStores, createApp, topology } from "@keel/server";
import { chart } from "@keel/std-statecharts";
import { flows, workflow } from "@keel/std-workflows";
import { tx } from "@keel/store";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { jobsOf } from "./modules/api/jobs.server.ts";
import { runnersOf } from "./modules/api/runners.server.ts";

export const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

export type Sim = SimCtx;
export const sim = (): Sim => createCtx({ mode: "sim", seed: 1337 });

/** Moves the sim clock `ms` in steps of `step`, settling after each. */
export async function pass(ctx: Sim, ms: number, step = 1000): Promise<void> {
  for (let t = 0; t < ms; t += step) {
    ctx.clock.advance(Math.min(step, ms - t));
    await settle();
  }
}

// ServerApp.close() is part of the runner contract (k.topology); read it without a cast.
export const close = async (app: unknown): Promise<void> => {
  const f: unknown = Reflect.get(Object(app), "close");
  if (typeof f !== "function") throw new Error("ServerApp.close is missing");
  await Reflect.apply(f, app, []);
};

let counter = 0;
/** A module-prefixed id no earlier fixture used, so two live stores never collide. */
export const nextId = (name: string): string => {
  counter += 1;
  return `api.${name}${counter}`;
};

export type Data = { n: number; freed: number; code: string };
export const START: Data = { n: 0, freed: 0, code: "" };
const DataSchema = s.object({ n: s.int({ min: 0, max: 3 }), freed: s.int({ min: 0, max: 3 }), code: s.string() });
const empty = s.object({});

/** The removal chart: `purging` is a step state, `hidden` a wait state; `purged`, `stuck` and `gone` are final. */
export const removalChart = () =>
  chart(nextId("removalChart"), {
    data: DataSchema,
    start: START,
    events: {
      begin: empty,
      hide: empty,
      purged: s.object({ freed: s.int({ min: 0, max: 3 }) }),
      stuck: s.object({ code: s.string() }),
      expired: empty,
      undo: empty,
    },
    actions: {
      record: (d, p) => ({ ...d, freed: p.freed }),
      fail: (d, p) => ({ ...d, code: p.code }),
    },
    initial: "queued",
    states: {
      queued: { on: { begin: "purging", hide: "hidden" } },
      purging: { on: { purged: { to: "purged", do: "record" }, stuck: { to: "stuck", do: "fail" } } },
      hidden: { on: { expired: "gone", undo: "queued" } },
      purged: { final: true },
      stuck: { final: true },
      gone: { final: true },
    },
  });

export type RunEnv = { signal: AbortSignal; key: string };
export type Run = (data: Data, ctx: Sim, env: RunEnv) => Promise<Result<{ freed: number }, KeelError<string, unknown>>>;
export type FlowOptions = { run: Run; attempts?: number; timeoutMs?: number; ms?: number };

/** A workflow over `removalChart` with its queue, ready to boot. */
export function makeFlow(o: FlowOptions) {
  const id = nextId("removal");
  const c = removalChart();
  const ms = o.ms ?? fixedTime(5000);
  const wf = workflow(id, {
    chart: c,
    steps: {
      purging: {
        run: o.run,
        done: "purged",
        failed: "stuck",
        attempts: o.attempts ?? 3,
        timeoutMs: o.timeoutMs ?? 60_000,
      },
    },
    waits: { hidden: { ms, event: "expired" } },
  });
  const jobs = jobsOf(wf);
  return { id, chart: c, wf, jobs, ms };
}
export type Flow = ReturnType<typeof makeFlow>;
export type Stores = ReturnType<Flow["wf"]["stores"]>;

export const boot = (ctx: Sim, f: Flow) =>
  createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { api: runnersOf(f.jobs, f.wf) },
  });

/** Runs `fn` against the workflow's stores through one `commitStores`, saving what it changed. */
export async function mutate<T>(ctx: Sim, f: Flow, fn: (S: Stores) => T): Promise<T> {
  const out: { v: T }[] = [];
  const r = await commitStores(ctx, f.wf.stores, (S) => {
    out.push({ v: fn(S) });
    return ok(null);
  });
  if (!r.ok) throw new Error(`commitStores failed: ${r.error.code}`);
  const last = out[out.length - 1];
  if (last === undefined) throw new Error("commitStores did not run fn");
  return last.v;
}

export type Row = { state: string; data: Data; entered: number; attempt: number };
export const rowsOf = (S: Stores): Record<string, Row> => structuredClone(S.store.snapshot().state.instances);
export const readRows = (ctx: Sim, f: Flow) => mutate(ctx, f, rowsOf);

export const start = (ctx: Sim, f: Flow, id: string, data: Data) =>
  mutate(ctx, f, (S) => {
    void tx(S.start, { id, data });
  });
/** `begin` for `id`; returns the instance's `entered` once it is in the step state. */
export const begin = (ctx: Sim, f: Flow, id: string) =>
  mutate(ctx, f, (S) => {
    void tx(S.events.begin, { id, payload: {} });
    return rowsOf(S)[id]?.entered ?? -1;
  });
export const hide = (ctx: Sim, f: Flow, id: string) =>
  mutate(ctx, f, (S) => {
    void tx(S.events.hide, { id, payload: {} });
    return rowsOf(S)[id]?.entered ?? -1;
  });
export const undo = (ctx: Sim, f: Flow, id: string) =>
  mutate(ctx, f, (S) => {
    void tx(S.events.undo, { id, payload: {} });
    return rowsOf(S)[id]?.entered ?? -1;
  });

/** Every chart event with its payload, for generated programs. */
export type Ev =
  | { name: "begin" | "hide" | "expired" | "undo" }
  | { name: "purged"; freed: number }
  | { name: "stuck"; code: string };
export const evArb: fc.Arbitrary<Ev> = fc.oneof(
  fc.constantFrom<Ev>({ name: "begin" }, { name: "hide" }, { name: "expired" }, { name: "undo" }),
  fc.integer({ min: 0, max: 3 }).map((freed): Ev => ({ name: "purged", freed })),
  fc.stringMatching(/^[a-z]{1,6}$/).map((code): Ev => ({ name: "stuck", code })),
);
export const dataArb: fc.Arbitrary<Data> = fc.record({
  n: fc.integer({ min: 0, max: 3 }),
  freed: fc.integer({ min: 0, max: 3 }),
  code: fc.stringMatching(/^[a-z]{0,6}$/),
});

/** Sends `ev` to `id` through the workflow's transaction for it. */
export function fire(S: Stores, id: string, ev: Ev): void {
  switch (ev.name) {
    case "purged":
      void tx(S.events.purged, { id, payload: { freed: ev.freed } });
      return;
    case "stuck":
      void tx(S.events.stuck, { id, payload: { code: ev.code } });
      return;
    default:
      void tx(S.events[ev.name], { id, payload: {} });
  }
}

export type Node = { state: string; data: Data };
/** `chart.next` of `from` by `ev`. */
export function nextOf(c: Flow["chart"], from: Node, ev: Ev): Node {
  const at = { state: from.state, data: from.data };
  switch (ev.name) {
    case "purged":
      return c.next(at, "purged", { freed: ev.freed });
    case "stuck":
      return c.next(at, "stuck", { code: ev.code });
    default:
      return c.next(at, ev.name, {});
  }
}
export const FINAL = ["purged", "stuck", "gone"];
