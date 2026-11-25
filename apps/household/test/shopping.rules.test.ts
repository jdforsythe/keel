import { createCtx } from "@keel/ctx";
import type { Infer } from "@keel/schema";
import type { JsonValue } from "@keel/schema";
import { OutboxEntry } from "@keel/std-offline";
import { instantOf } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Item } from "../modules/shopping/Item.schema.ts";
import { QueuedMark } from "../modules/shopping/QueuedMark.schema.ts";
import { Refusal } from "../modules/shopping/Refusal.schema.ts";
import { addTo } from "../modules/shopping/addTo.ts";
import { markOf } from "../modules/shopping/markOf.ts";
import { pageOrigin } from "../modules/shopping/pageOrigin.ts";
import { putBackIn } from "../modules/shopping/putBackIn.ts";
import { restockStores } from "../modules/shopping/restockStores.server.ts";
import { runsOf } from "../modules/shopping/runsOf.ts";
import { startRun } from "../modules/shopping/startRun.ts";
import { toggleIn } from "../modules/shopping/toggleIn.ts";
import { weeklyStaples } from "../modules/shopping/weeklyStaples.ts";
import { SEED, rejectsAt } from "./schemas.ts";
import { using } from "./using.ts";

type Row = Infer<typeof Item>;
const NAMES = ["Milk", "Bread", "Eggs"];
const idOf = (n: number): Row["id"] => {
  const r = Item.parse({ id: `item-${n}`, name: "x", qty: 1, bought: false, rev: 0 });
  if (!r.ok) throw new Error("no id");
  return r.value.id;
};
const row = (n: number, name: string, over: Partial<Row> = {}): Row => ({
  id: idOf(n),
  name,
  qty: 1,
  bought: false,
  rev: 0,
  ...over,
});

type Op = { kind: "add"; name: string } | { kind: "toggle"; at: number } | { kind: "putBack"; name: string };
const ops = fc.array(
  fc.oneof(
    fc.record({ kind: fc.constant("add" as const), name: fc.constantFrom(...NAMES) }),
    fc.record({ kind: fc.constant("toggle" as const), at: fc.nat(60) }),
    fc.record({ kind: fc.constant("putBack" as const), name: fc.constantFrom(...NAMES) }),
  ),
  { maxLength: 150 },
);

/** `ops` applied in order from an empty list; ids are minted in order, as the server mints them. */
const apply = (list: readonly Op[], from: readonly Row[] = [], first = 0): Row[] =>
  list.reduce<Row[]>(
    (items, op, k) => {
      const n = first + k;
      if (op.kind === "add") return addTo(items, { id: idOf(n), name: op.name });
      if (op.kind === "putBack") return putBackIn(items, { id: idOf(n), name: op.name });
      const target = items[op.at % Math.max(items.length, 1)];
      return target === undefined ? items : toggleIn(items, target.id);
    },
    [...from],
  );

it("raises the quantity of a name still to buy up to 99, and adds a new name as one", () => {
  expect(addTo([], { id: idOf(1), name: "Milk" })).toEqual([row(1, "Milk")]);
  const once = addTo([row(1, "Milk")], { id: idOf(2), name: "Milk" });
  expect(once).toEqual([row(1, "Milk", { qty: 2 })]);
  expect(addTo([row(1, "Milk", { qty: 99 })], { id: idOf(2), name: "Milk" })).toEqual([row(1, "Milk", { qty: 99 })]);
  expect(addTo([row(1, "Milk", { bought: true })], { id: idOf(2), name: "Milk" })).toEqual([
    row(1, "Milk", { bought: true }),
    row(2, "Milk"),
  ]);
});

it("stops adding at 50 items and ignores an id already taken", () => {
  const full = Array.from({ length: 50 }, (_, n) => row(n, `Item ${n}`));
  expect(addTo(full, { id: idOf(99), name: "Another" })).toEqual(full);
  expect(addTo(full, { id: idOf(99), name: "Item 3" })[3]?.qty).toBe(2);
  const some = [row(1, "Milk")];
  expect(addTo(some, { id: idOf(1), name: "Bread" })).toEqual(some);
});

it("puts a name back once: a name to buy stays, a bought one returns as one, a new name joins below 50", () => {
  expect(putBackIn([row(1, "Milk", { qty: 3 })], { id: idOf(2), name: "Milk" })).toEqual([row(1, "Milk", { qty: 3 })]);
  expect(putBackIn([row(1, "Milk", { qty: 3, bought: true })], { id: idOf(2), name: "Milk" })).toEqual([
    row(1, "Milk", { qty: 1 }),
  ]);
  expect(putBackIn([], { id: idOf(2), name: "Milk" })).toEqual([row(2, "Milk")]);
  const full = Array.from({ length: 50 }, (_, n) => row(n, `Item ${n}`));
  expect(putBackIn(full, { id: idOf(99), name: "Another" })).toEqual(full);
});

it("moves an item between to buy and bought, merging a return into the open item of the same name", () => {
  expect(toggleIn([row(1, "Milk")], idOf(1))).toEqual([row(1, "Milk", { bought: true })]);
  expect(toggleIn([row(1, "Milk", { bought: true })], idOf(1))).toEqual([row(1, "Milk")]);
  const both = [row(1, "Milk", { qty: 2, bought: true }), row(2, "Milk", { qty: 3 })];
  expect(toggleIn(both, idOf(1))).toEqual([row(2, "Milk", { qty: 5 })]);
  expect(toggleIn([row(1, "Milk", { qty: 98, bought: true }), row(2, "Milk", { qty: 5 })], idOf(1))).toEqual([
    row(2, "Milk", { qty: 99 }),
  ]);
  const one = [row(1, "Milk")];
  expect(toggleIn(one, idOf(7))).toEqual(one);
});

it("keeps the list's rules through any run of adds, toggles and put-backs: one open item per name, 50 at most, quantities 1 to 99", () => {
  fc.assert(
    fc.property(ops, (list) => {
      let items: Row[] = [];
      list.forEach((op, n) => {
        items = apply([op], items, n);
        const open = items.filter((i) => !i.bought).map((i) => i.name);
        expect(new Set(open).size).toBe(open.length);
        expect(items.length).toBeLessThanOrEqual(50);
        expect(items.every((i) => i.qty >= 1 && i.qty <= 99)).toBe(true);
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      });
    }),
    { numRuns: 200, seed: SEED },
  );
});

it("never changes the list when a toggle names an item that is not on it, and toggles back to where it was when there is nothing to merge", () => {
  fc.assert(
    fc.property(ops, fc.nat(60), (list, at) => {
      const items = apply(list);
      expect(toggleIn(items, idOf(1_000_000))).toEqual(items);
      const target = items[at % Math.max(items.length, 1)];
      if (target === undefined || target.bought) return;
      const once = toggleIn(items, target.id);
      const sameName = items.some((i) => i.id !== target.id && i.name === target.name && i.bought === false);
      if (!sameName) expect(toggleIn(once, target.id)).toEqual(items);
    }),
    { numRuns: 200, seed: SEED },
  );
});

it("names the five weekly staples in their order, and reads a mark from an outbox entry", () => {
  expect(weeklyStaples).toEqual(["Milk", "Bread", "Eggs", "Rice", "Apples"]);
  const entry = (endpoint: string, input: JsonValue): OutboxEntry => {
    const r = OutboxEntry.parse({ key: "write-1", endpoint, owner: "u1", input, base: 0, at: 0, state: "conflict" });
    if (!r.ok) throw new Error(`not an outbox entry: ${r.error.message}`);
    return r.value;
  };
  const call = { params: { id: "item-1" }, body: { bought: true } };
  expect(markOf(entry("mark", call))).toEqual({ id: "item-1", bought: true });
  expect(markOf(entry("mark", { ...call, body: { bought: false } }))).toEqual({ id: "item-1", bought: false });
  expect(markOf(entry("add", call))).toBeUndefined();
  expect(markOf(entry("mark", { params: {}, body: {} }))).toBeUndefined();
  expect(QueuedMark.parse(call).ok).toBe(true);
  rejectsAt(QueuedMark, { params: { id: "" }, body: { bought: true } }, "params.id");
  expect(Refusal.parse({ code: "keel.notFound", data: { status: 404 } }).ok).toBe(true);
  expect(Refusal.parse({ code: "offline.owner", data: {} }).ok).toBe(true);
  rejectsAt(Refusal, { code: "x", data: { status: "404" } }, "data.status");
});

it("reads the page's origin only in a browser", () => {
  expect(pageOrigin()).toBe(location.origin);
});

it("shows the run started last, how many are kept, and counts a done run's staples as handled", () => {
  const at = (ms: number) => {
    const r = instantOf(ms);
    if (!r.ok) throw new Error("no instant");
    return r.value;
  };
  const data = (ms: number, next: number, putBack: number, code = "") => ({
    staples: weeklyStaples,
    next,
    putBack,
    by: "member" as const,
    at: at(ms),
    code,
  });
  expect(runsOf({})).toEqual({ last: null, kept: 0 });
  const runs = runsOf({
    a: { state: "done", data: data(1_000, 4, 5) },
    b: { state: "resting", data: data(2_000, 2, 2) },
    c: { state: "failed", data: data(500, 1, 0, "step.failed") },
  });
  expect(runs.kept).toBe(3);
  expect(runs.last).toMatchObject({ state: "running", handled: 2, putBack: 2, total: 5 });
  expect(runsOf({ a: { state: "done", data: data(1_000, 4, 5) } }).last).toMatchObject({
    state: "done",
    handled: 5,
    total: 5,
  });
  expect(runsOf({ c: { state: "failed", data: data(500, 1, 0, "step.failed") } }).last).toMatchObject({
    state: "failed",
    handled: 1,
    code: "step.failed",
  });
});

it("starts a weekly run unless one is going, and a schedule start only once a UTC day", async () => {
  const ctx = createCtx({ mode: "sim", seed: 150 });
  await using(
    () => restockStores(ctx),
    (stores) => {
      const go = (by: "schedule" | "member", ms: number, id: string) => {
        const at = instantOf(ms);
        if (!at.ok) throw new Error("no instant");
        return startRun(stores, { id, by, at: at.value });
      };
      const flowId = (n: number) => `flow-${n}`;
      expect(go("member", 1_000, flowId(1))).toEqual({ ok: true, value: true });
      expect(Object.keys(stores.restock.store.get("instances"))).toEqual([flowId(1)]);
      expect(go("member", 2_000, flowId(2))).toEqual({ ok: true, value: false });
      expect(go("schedule", 3_000, flowId(3))).toEqual({ ok: true, value: false });
      expect(Object.keys(stores.restock.store.get("instances"))).toHaveLength(1);
    },
  );
});
