// The parts of the list removal workflow on their own: its four schemas, `api.purgeList`, the `purge` and `restore`
// steps, the `removal` workflow store, the `jobs` queue and the two actions, each called directly on a sim ctx.
import { type Ctx, type KeyValueStorage, type SimCtx, type StorageWrite, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { flows } from "@keel/std-workflows";
import { isolate, tx } from "@keel/store";
import { properties, simulate } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { FlowParams } from "../modules/api/FlowParams.schema.ts";
import { ListParams } from "../modules/api/ListParams.schema.ts";
import { Removal } from "../modules/api/Removal.schema.ts";
import { RemovalData } from "../modules/api/RemovalData.schema.ts";
import { StepFailure } from "../modules/api/StepFailure.schema.ts";
import { board } from "../modules/api/board.ts";
import { boardStores } from "../modules/api/boardStores.ts";
import { jobs } from "../modules/api/jobs.server.ts";
import { postRemove } from "../modules/api/postRemove.server.ts";
import { postUndoRemoval } from "../modules/api/postUndoRemoval.server.ts";
import { purge } from "../modules/api/purge.server.ts";
import { purgeList } from "../modules/api/purgeList.ts";
import { removal } from "../modules/api/removal.server.ts";
import { removalStores } from "../modules/api/removalStores.server.ts";
import { restore } from "../modules/api/restore.server.ts";
import { at, boardOf } from "./at.ts";
import { BOARD_KEY } from "./simApi.ts";

const WAIT = 600_000;
const FLOW_KEY = "keel.store.api.removal";

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});
/** Run `make` in a fresh isolated scope (k.store `isolate`), disposed after the test: ids never collide. */
const inScope = <T>(make: () => T): T => {
  const sc = scope(() => undefined);
  isolate(sc);
  scopes.push(sc);
  return sc.run(make);
};

const home = { id: "l1", name: "Home" };
const work = { id: "l2", name: "Work" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const eggs = { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true } as const;
const report = { id: "t3", listId: "l2", title: "Report", priority: "high", done: false } as const;
const both = boardOf({ lists: [home, work], todos: [milk, eggs, report] });
/** A `TodoList` id, branded by parsing it as route params do. */
const listId = (id: string) => at(ListParams, { listId: id }).params.listId;

/** A sim ctx whose storage holds `state` as the api's board. */
async function seeded(state = both, seed = 5): Promise<SimCtx> {
  const ctx = createCtx({ mode: "sim", seed });
  await ctx.storage.set(BOARD_KEY, JSON.stringify({ state, log: [], initial: state }));
  return ctx;
}
async function storedBoard(ctx: Ctx) {
  const raw = await ctx.storage.get(BOARD_KEY);
  return boardOf(Reflect.get(Object(raw === null ? {} : JSON.parse(raw)), "state"));
}
type Row = { state: string; data: RemovalData; entered: number; attempt: number };
/** The stored `api.removal` instances by flow id, and the stored log's `[name, payload]` pairs. */
async function storedFlows(ctx: Ctx): Promise<{ rows: Record<string, Row>; log: [string, unknown][] }> {
  const raw = await ctx.storage.get(FLOW_KEY);
  const snap: unknown = raw === null ? {} : JSON.parse(raw);
  const rows: Record<string, Row> = Object(Reflect.get(Object(Reflect.get(Object(snap), "state")), "instances"));
  const entries: unknown = Reflect.get(Object(snap), "log");
  const log: [string, unknown][] = Array.isArray(entries)
    ? entries.map((e: unknown) => [String(Reflect.get(Object(e), "name")), Reflect.get(Object(e), "payload")])
    : [];
  return { rows, log };
}

/** `ctx` with a storage that refuses every `commit` whose writes `refuse` holds for. */
function refusing(ctx: SimCtx, refuse: (writes: readonly StorageWrite[]) => boolean): Ctx {
  const s = ctx.storage;
  const storage: KeyValueStorage = {
    get: (k) => s.get(k),
    set: (k, v) => s.set(k, v),
    read: (keys) => s.read(keys),
    commit: async (writes) => (refuse(writes) ? false : s.commit(writes)),
  };
  return { clock: ctx.clock, random: ctx.random, net: ctx.net, storage, dispose: ctx.dispose };
}

/** Microtask turns for runners and jobs to settle; no timers. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
/** Run `jobs` and `flows(jobs, [removal])` over `ctx` while the sim clock moves `ms` in steps of 1,000. */
async function runFor(ctx: Ctx, clock: SimCtx["clock"], ms: number): Promise<void> {
  const stop = new AbortController();
  const running = [jobs.run(ctx, stop.signal), flows(jobs, [removal]).run(ctx, stop.signal)];
  try {
    await settle();
    for (let t = 0; t < ms; t += 1000) {
      clock.advance(Math.min(1000, ms - t));
      await settle();
    }
  } finally {
    stop.abort();
    await Promise.allSettled(running);
  }
}

/** Sim-ctx generators for the schema properties. */
const pick = <T>(ctx: SimCtx, xs: readonly [T, ...T[]]): T => xs[Math.floor(ctx.random.float() * xs.length)] ?? xs[0];
const ALPHA = "abcdefghijklmnopqrstuvwxyz0123456789-";
const word = (ctx: SimCtx): string => {
  const n = 1 + Math.floor(ctx.random.float() * 24);
  return Array.from({ length: n }, () => ALPHA.charAt(Math.floor(ctx.random.float() * ALPHA.length))).join("");
};
/** A value no string field accepts. */
const notString = (ctx: SimCtx): unknown => pick(ctx, [0, 7, true, null, [], {}, ["x"]]);
const RUNNING = ["hidden", "purging", "restoring"] as const;
const CODES = ["workflows.attempts", "api.purgeFailed", "api.restoreFailed"] as const;

describe("FlowParams", () => {
  it("accepts any non-empty flow and refuses an empty, missing or non-string one", () => {
    expect(FlowParams.parse({ flow: "f1" })).toEqual({ ok: true, value: { flow: "f1" } });
    expect(FlowParams.parse({ flow: "" }).ok).toBe(false);
    expect(FlowParams.parse({}).ok).toBe(false);
    expect(FlowParams.parse({ flow: 1 }).ok).toBe(false);
    expect(FlowParams.parse(null).ok).toBe(false);
  });
  it("round-trips generated flows and refuses them as other types", async () => {
    await simulate(
      ({ ctx }) => {
        const flow = word(ctx);
        expect(FlowParams.parse({ flow })).toEqual({ ok: true, value: { flow } });
        expect(FlowParams.parse({ flow: notString(ctx) }).ok).toBe(false);
      },
      { runs: 100, seed: 1337 },
    );
  });
});

describe("Removal", () => {
  it("holds a running state only: final chart states are refused", () => {
    const r = { flow: "f1", list: "l1", state: "hidden" };
    expect(Removal.parse(r)).toEqual({ ok: true, value: r });
    for (const state of ["removed", "kept", "stuck", "Hidden", ""])
      expect(Removal.parse({ ...r, state }).ok).toBe(false);
    expect(Removal.parse({ ...r, flow: "" }).ok).toBe(false);
    expect(Removal.parse({ ...r, list: "" }).ok).toBe(false);
  });
  it("round-trips generated removals and refuses one missing any field", async () => {
    await simulate(
      ({ ctx }) => {
        const r = { flow: word(ctx), list: word(ctx), state: pick(ctx, RUNNING) };
        expect(Removal.parse(r)).toEqual({ ok: true, value: r });
        const { [pick(ctx, ["flow", "list", "state"] as const)]: _dropped, ...missing } = r;
        expect(Removal.parse(missing).ok).toBe(false);
        expect(Removal.parse({ ...r, [pick(ctx, ["flow", "list"] as const)]: notString(ctx) }).ok).toBe(false);
      },
      { runs: 100, seed: 1337 },
    );
  });
});

describe("RemovalData", () => {
  it("is a list or nothing (a chart's start)", () => {
    expect(RemovalData.parse({})).toEqual({ ok: true, value: {} });
    expect(RemovalData.parse({ list: "l1" })).toEqual({ ok: true, value: { list: "l1" } });
    expect(RemovalData.parse({ list: "" }).ok).toBe(false);
    expect(RemovalData.parse({ list: 1 }).ok).toBe(false);
    expect(RemovalData.parse(null).ok).toBe(false);
  });
  it("round-trips generated data with and without a list", async () => {
    await simulate(
      ({ ctx }) => {
        const d = ctx.random.float() < 0.5 ? {} : { list: word(ctx) };
        expect(RemovalData.parse(d)).toEqual({ ok: true, value: d });
        expect(RemovalData.parse({ list: notString(ctx) }).ok).toBe(false);
      },
      { runs: 100, seed: 1337 },
    );
  });
});

describe("StepFailure", () => {
  it("accepts the three failure codes and nothing else", () => {
    for (const code of CODES) expect(StepFailure.parse({ code })).toEqual({ ok: true, value: { code } });
    for (const code of ["keel.notFound", "keel.conflict", "api.purgefailed", ""])
      expect(StepFailure.parse({ code }).ok).toBe(false);
    expect(StepFailure.parse({}).ok).toBe(false);
  });
  it("refuses generated codes outside the enum and keeps each one in it", async () => {
    await simulate(
      ({ ctx }) => {
        const code = pick(ctx, CODES);
        expect(StepFailure.parse({ code })).toEqual({ ok: true, value: { code } });
        const other = `${pick(ctx, ["api", "workflows", "keel"])}.${word(ctx)}`;
        expect(StepFailure.parse({ code: other }).ok).toBe(CODES.some((c) => c === other));
      },
      { runs: 100, seed: 1337 },
    );
  });
});

describe("api.purgeList", () => {
  it("keeps the invariant, undoes exactly and is deterministic for generated boards and ids", async () => {
    await properties(purgeList(inScope(board)), { runs: 100, seed: 1337 });
  });
  it("removes the list and its todos and keeps every other list and todo in order", () => {
    const st = inScope(boardStores);
    expect(st.board.restore({ state: both, log: [], initial: both }).ok).toBe(true);
    expect(tx(st.purgeList, { id: listId("l1") }).ok).toBe(true);
    expect(st.board.get("lists")).toEqual([work]);
    expect(st.board.get("todos")).toEqual([report]);
  });
  it("leaves the board unchanged for an unknown id", () => {
    const st = inScope(boardStores);
    expect(st.board.restore({ state: both, log: [], initial: both }).ok).toBe(true);
    expect(tx(st.purgeList, { id: listId("l9") }).ok).toBe(true);
    expect(st.board.get("lists")).toEqual(both.lists);
    expect(st.board.get("todos")).toEqual(both.todos);
  });
});

describe("purge and restore steps", () => {
  it("purge deletes the list and its todos in the stored board and answers ok({})", async () => {
    const ctx = await seeded();
    expect(await purge({ list: listId("l1") }, ctx)).toEqual({ ok: true, value: {} });
    const after = await storedBoard(ctx);
    expect(after.lists).toEqual([work]);
    expect(after.todos).toEqual([report]);
  });
  it("purge with no list changes nothing", async () => {
    const ctx = await seeded();
    expect(await purge({}, ctx)).toEqual({ ok: true, value: {} });
    expect(await storedBoard(ctx)).toEqual(both);
  });
  it("a purge whose commit is refused is api.purgeFailed with the cause, and the board is kept", async () => {
    const sim = await seeded();
    const r = await purge(
      { list: listId("l1") },
      refusing(sim, () => true),
    );
    expect(r.ok ? null : r.error).toMatchObject({ code: "api.purgeFailed", data: { cause: "keel.conflict" } });
    expect(await storedBoard(sim)).toEqual(both);
  });
  it("restore shows a hidden list again; refused, it is api.restoreFailed", async () => {
    const hidden = boardOf({ lists: [{ ...home, hidden: true }, work], todos: [milk] });
    const sim = await seeded(hidden);
    const refused = await restore(
      { list: listId("l1") },
      refusing(sim, () => true),
    );
    expect(refused.ok ? null : refused.error).toMatchObject({ code: "api.restoreFailed" });
    expect((await storedBoard(sim)).lists).toEqual(hidden.lists);
    expect(await restore({ list: listId("l1") }, sim)).toEqual({ ok: true, value: {} });
    expect((await storedBoard(sim)).lists).toEqual([{ ...home, hidden: false }, work]);
    expect((await storedBoard(sim)).todos).toEqual([milk]);
  });
});

describe("removal", () => {
  it("is store api.removal; an instance starts hidden and moves by the chart", () => {
    expect(removal.id).toBe("api.removal");
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const st = inScope(() => removal.stores(ctx));
    expect(tx(st.start, { id: "f1", data: { list: listId("l1") } }).ok).toBe(true);
    expect(st.store.get("instances").f1).toMatchObject({ state: "hidden", data: { list: "l1" } });
    // A repeat start leaves the instance as it is.
    expect(tx(st.events.expired, { id: "f1", payload: {} }).ok).toBe(true);
    expect(tx(st.start, { id: "f1", data: { list: listId("l2") } }).ok).toBe(true);
    expect(st.store.get("instances").f1).toMatchObject({ state: "purging", data: { list: "l1" } });
    expect(tx(st.events.purged, { id: "f1", payload: {} }).ok).toBe(true);
    expect(st.store.get("instances").f1?.state).toBe("removed");
    // A final instance takes no event, and only it can be forgotten.
    expect(tx(st.events.undo, { id: "f1", payload: {} }).ok).toBe(true);
    expect(st.store.get("instances").f1?.state).toBe("removed");
    expect(tx(st.forget, { id: "f1" }).ok).toBe(true);
    expect(st.store.get("instances").f1).toBeUndefined();
  });
  it("a step's failed event takes a StepFailure code and refuses any other", () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const st = inScope(() => removal.stores(ctx));
    expect(tx(st.start, { id: "f1", data: { list: listId("l1") } }).ok).toBe(true);
    expect(tx(st.events.expired, { id: "f1", payload: {} }).ok).toBe(true);
    for (const code of ["api.nope", "keel.conflict"])
      expect(st.events.purgeFailed.schema.parse({ id: "f1", payload: { code } }).ok).toBe(false);
    expect(st.events.purgeFailed.schema.parse({ id: "f1", payload: {} }).ok).toBe(false);
    expect(tx(st.events.purgeFailed, { id: "f1", payload: { code: "api.purgeFailed" } }).ok).toBe(true);
    expect(st.store.get("instances").f1?.state).toBe("restoring");
    expect(tx(st.events.restoreFailed, { id: "f1", payload: { code: "api.restoreFailed" } }).ok).toBe(true);
    expect(st.store.get("instances").f1?.state).toBe("stuck");
  });
  it("its jobs are the purging and restoring steps plus a wake and a forget", () => {
    expect(Object.keys(removal.jobs).sort()).toEqual(
      ["api.removal.forget", "api.removal.purging", "api.removal.restoring", "api.removal.wake"].sort(),
    );
  });
});

/** Start a removal of `list` on `ctx` through `postRemove`, saved as the action saves it; its flow id. */
async function removeOn(ctx: Ctx, list: string): Promise<string> {
  const r = await commitStores(ctx, removalStores, async (S) => {
    const out = await postRemove.run({}, { ...at(ListParams, { listId: list }), stores: S }, ctx);
    return out.ok ? ok(Object.keys(S.removal.store.get("instances"))) : out;
  });
  if (!r.ok) throw new Error(r.error.code);
  const flow = r.value[0];
  if (flow === undefined) throw new Error("no removal started");
  return flow;
}
const undoOn = (ctx: Ctx, flow: string) =>
  commitStores(ctx, removalStores, (S) => postUndoRemoval.run({}, { ...at(FlowParams, { flow }), stores: S }, ctx));

describe("jobs", () => {
  it("holds removal's jobs and refuses an input that does not parse", async () => {
    expect(Object.keys(jobs.table).sort()).toEqual(Object.keys(removal.jobs).sort());
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const r = await jobs.enqueue(ctx, "api.removal.purging", { id: "", entered: -1 });
    expect(r.ok ? null : r.error.code).toBe("keel.fields");
  });
  it("runs an enqueued purging step: the list is purged and the instance ends removed", async () => {
    const ctx = await seeded();
    const started = await commitStores(ctx, removalStores, (S) => {
      const steps = [
        tx(S.hideList, { id: listId("l1") }),
        tx(S.removal.start, { id: "f1", data: { list: listId("l1") } }),
        tx(S.removal.events.expired, { id: "f1", payload: {} }),
      ];
      return steps.every((t) => t.ok) ? ok(null) : ok("refused");
    });
    expect(started).toEqual({ ok: true, value: null });
    const entered = (await storedFlows(ctx)).rows.f1?.entered ?? -1;
    expect((await jobs.enqueue(ctx, "api.removal.purging", { id: "f1", entered })).ok).toBe(true);
    const stop = new AbortController();
    const running = jobs.run(ctx, stop.signal);
    for (let i = 0; i < 5; i++) {
      ctx.clock.advance(1000);
      await settle();
    }
    stop.abort();
    await running;
    expect((await storedBoard(ctx)).lists).toEqual([work]);
    expect((await storedFlows(ctx)).rows.f1?.state).toBe("removed");
  });
  it("with flows, three refused purges end in a purgeFailed with the step's code and the list kept", async () => {
    const sim = await seeded();
    const flow = await removeOn(sim, "l1");
    // Refuse only the purge's commit: a board save without list l1.
    const ctx = refusing(sim, (writes) =>
      writes.some(
        (w) =>
          w.key === BOARD_KEY &&
          w.value !== undefined &&
          !boardOf(JSON.parse(w.value).state).lists.some((l) => l.id === "l1"),
      ),
    );
    await runFor(ctx, sim.clock, WAIT + 180_000);
    const { rows, log } = await storedFlows(sim);
    expect(log.filter(([name]) => name === "api.removal.purgeFailed").map(([, p]) => p)).toEqual([
      { id: flow, payload: { code: "api.purgeFailed" } },
    ]);
    expect(rows[flow]?.state).not.toBe("removed");
    expect((await storedBoard(sim)).lists.map((l) => l.id)).toEqual(["l1", "l2"]);
  });
});

describe("postRemove", () => {
  it("hides the list and starts one hidden removal of it", async () => {
    const ctx = createCtx({ mode: "sim", seed: 3 });
    const st = inScope(() => removalStores(ctx));
    expect(st.board.restore({ state: both, log: [], initial: both }).ok).toBe(true);
    const r = await postRemove.run({}, { ...at(ListParams, { listId: "l1" }), stores: st }, ctx);
    expect(r).toEqual({ ok: true, value: {} });
    expect(st.board.get("lists")).toEqual([{ ...home, hidden: true }, work]);
    expect(st.board.get("todos")).toEqual(both.todos);
    const rows = Object.values(st.removal.store.get("instances"));
    expect(rows).toMatchObject([{ state: "hidden", data: { list: "l1" } }]);
  });
  it("refuses a hidden or unknown list with keel.notFound and starts nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: 3 });
    const st = inScope(() => removalStores(ctx));
    expect(st.board.restore({ state: both, log: [], initial: both }).ok).toBe(true);
    expect((await postRemove.run({}, { ...at(ListParams, { listId: "l1" }), stores: st }, ctx)).ok).toBe(true);
    for (const id of ["l1", "l9"]) {
      const r = await postRemove.run({}, { ...at(ListParams, { listId: id }), stores: st }, ctx);
      expect(r.ok ? null : r.error).toMatchObject({ code: "keel.notFound", data: { listId: id } });
    }
    expect(Object.keys(st.removal.store.get("instances"))).toHaveLength(1);
  });
  it("after the 10-minute wait the removed list and its todos are purged", async () => {
    const ctx = await seeded();
    const flow = await removeOn(ctx, "l1");
    await runFor(ctx, ctx.clock, WAIT - 60_000);
    expect((await storedBoard(ctx)).lists).toEqual([{ ...home, hidden: true }, work]);
    await runFor(ctx, ctx.clock, 180_000);
    expect(await storedBoard(ctx)).toEqual(boardOf({ lists: [work], todos: [report] }));
    expect((await storedFlows(ctx)).rows[flow]?.state).toBe("removed");
  });
});

describe("postUndoRemoval", () => {
  it("an undo while hidden moves the removal to restoring, and the list is shown again", async () => {
    const ctx = await seeded();
    const flow = await removeOn(ctx, "l1");
    expect(await undoOn(ctx, flow)).toEqual({ ok: true, value: {} });
    expect((await storedFlows(ctx)).rows[flow]?.state).toBe("restoring");
    await runFor(ctx, ctx.clock, 10_000);
    expect((await storedFlows(ctx)).rows[flow]?.state).toBe("kept");
    expect((await storedBoard(ctx)).lists).toEqual([{ ...home, hidden: false }, work]);
    await runFor(ctx, ctx.clock, WAIT + 60_000);
    expect((await storedBoard(ctx)).todos).toEqual(both.todos);
  });
  it("an undo after the wait has passed is keel.notFound and the list stays purged", async () => {
    const ctx = await seeded();
    const flow = await removeOn(ctx, "l1");
    await runFor(ctx, ctx.clock, WAIT + 120_000);
    const r = await undoOn(ctx, flow);
    expect(r.ok ? null : r.error).toMatchObject({ code: "keel.notFound", data: { flow } });
    expect((await storedBoard(ctx)).lists).toEqual([work]);
  });
  it("an unknown flow, or a second undo, is keel.notFound", async () => {
    const ctx = await seeded();
    const flow = await removeOn(ctx, "l1");
    const unknown = await undoOn(ctx, "f-none");
    expect(unknown.ok ? null : unknown.error.code).toBe("keel.notFound");
    expect((await undoOn(ctx, flow)).ok).toBe(true);
    const again = await undoOn(ctx, flow);
    expect(again.ok ? null : again.error.code).toBe("keel.notFound");
  });
});
