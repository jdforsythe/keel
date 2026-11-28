// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { type Infer, ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { NoRows, sql } from "@keel/std-postgres";
import { expect, it } from "vitest";
import { Item } from "../modules/shopping/Item.schema.ts";
import { ItemRef } from "../modules/shopping/ItemRef.schema.ts";
import { ListData } from "../modules/shopping/ListData.schema.ts";
import { MarkBought } from "../modules/shopping/MarkBought.schema.ts";
import { PutBack } from "../modules/shopping/PutBack.schema.ts";
import { RestockData } from "../modules/shopping/RestockData.schema.ts";
import { Runs } from "../modules/shopping/Runs.schema.ts";
import { changeList } from "../modules/shopping/changeList.server.ts";
import { deleteItem } from "../modules/shopping/deleteItem.server.ts";
import { getItems } from "../modules/shopping/getItems.server.ts";
import { getRuns } from "../modules/shopping/getRuns.server.ts";
import { listEvents } from "../modules/shopping/listEvents.server.ts";
import { listOf } from "../modules/shopping/listOf.server.ts";
import { loadList } from "../modules/shopping/loadList.server.ts";
import { markBought } from "../modules/shopping/markBought.server.ts";
import { postBought } from "../modules/shopping/postBought.server.ts";
import { postItem } from "../modules/shopping/postItem.server.ts";
import { postRun } from "../modules/shopping/postRun.server.ts";
import { putBack } from "../modules/shopping/putBack.server.ts";
import { restockStores } from "../modules/shopping/restockStores.server.ts";
import { runEvents } from "../modules/shopping/runEvents.server.ts";
import { runners } from "../modules/shopping/runners.server.ts";
import { runsOf } from "../modules/shopping/runsOf.ts";
import { schedules } from "../modules/shopping/schedules.server.ts";
import { shopping } from "../modules/shopping/shopping.contract.ts";
import { shoppingDb } from "../modules/shopping/shoppingDb.server.ts";
import { startRestock } from "../modules/shopping/startRestock.server.ts";
import { toggleItem } from "../modules/shopping/toggleItem.server.ts";
import { weeklyStaples } from "../modules/shopping/weeklyStaples.ts";
import { writeList } from "../modules/shopping/writeList.server.ts";
import { must } from "./must.ts";
import { using } from "./using.ts";

type Row = Infer<typeof Item>;
const ghost = (() => {
  const r = ItemRef.parse({ id: "00000000-0000-4000-8000-000000000000" });
  if (!r.ok) throw new Error("no id");
  return r.value.id;
})();
const sim = (seed: number) => createCtx({ mode: "sim", seed });
const ADA = "user-ada";
const GRACE = "user-grace";
const call = (user: string, params: unknown = {}) => ({ params, url: "http://localhost/api", caller: "c", user });
const read = (user: string, params: unknown = {}) => ({ ...call(user, params), search: {} });
const idOf = async (ctx: ReturnType<typeof sim>, name: string): Promise<Row["id"]> => {
  const list = await listOf(ctx);
  const found = list.ok ? list.value.find((i) => i.name === name) : undefined;
  if (found === undefined) throw new Error(`${name} is not on the list`);
  return found.id;
};

/** `items` of an answer `{ items }` as `name xqty` (bought ones marked). */
const lines = (answer: unknown): string[] => {
  const parsed = s.object({ ok: s.literal(true), value: s.object({ items: s.array(Item) }) }).parse(answer);
  return parsed.ok
    ? parsed.value.value.items.map((i) => `${i.name} x${i.qty}${i.bought ? " bought" : ""}`)
    : ["<not an answer>"];
};

it("starts with an empty list, adds a name once and raises it on the second add, with ids the ctx minted", async () => {
  const ctx = sim(160);
  expect(await getItems.run(read(ADA), ctx)).toEqual({ ok: true, value: { items: [] } });
  expect(lines(await postItem.run({ name: "Milk" }, call(ADA), ctx))).toEqual(["Milk x1"]);
  expect(lines(await postItem.run({ name: "Milk" }, call(GRACE), ctx))).toEqual(["Milk x2"]);
  expect(lines(await postItem.run({ name: "Eggs" }, call(ADA), ctx))).toEqual(["Milk x2", "Eggs x1"]);
  const got = await getItems.run(read(ADA), ctx);
  expect(lines(got)).toEqual(["Milk x2", "Eggs x1"]);
  const ids = got.ok ? s.object({ items: s.array(Item) }).parse(got.value) : null;
  expect(ids?.ok && new Set(ids.value.items.map((i) => i.id)).size).toBe(2);
});

it("marks an item bought and back, merges a return into the open item, and leaves the list as it is for an unknown id", async () => {
  const ctx = sim(161);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  const milk = await idOf(ctx, "Milk");
  const swap = (id: string) => toggleItem.run({}, call(ADA, { id }), ctx);
  expect(lines(await swap(milk))).toEqual(["Milk x1 bought"]);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  expect(lines(await getItems.run(read(ADA), ctx))).toEqual(["Milk x1 bought", "Milk x1"]);
  expect(lines(await swap(milk))).toEqual(["Milk x2"]);
  expect(lines(await swap(ghost))).toEqual(["Milk x2"]);
});

it("removes an item, and answers the list unchanged when the item is already gone", async () => {
  const ctx = sim(162);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  must(await postItem.run({ name: "Eggs" }, call(ADA), ctx));
  const milk = await idOf(ctx, "Milk");
  expect(lines(await deleteItem.run({}, call(ADA, { id: milk }), ctx))).toEqual(["Eggs x1"]);
  expect(lines(await deleteItem.run({}, call(ADA, { id: milk }), ctx))).toEqual(["Eggs x1"]);
});

it("raises an item's rev once per change and leaves it when nothing changed, in one transaction", async () => {
  const ctx = sim(163);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  const rev = async () => {
    const list = await listOf(ctx);
    return list.ok ? list.value.map((i) => i.rev) : [];
  };
  expect(await rev()).toEqual([0]);
  const milk = await idOf(ctx, "Milk");
  must(await toggleItem.run({}, call(ADA, { id: milk }), ctx));
  expect(await rev()).toEqual([1]);
  const same = await changeList(ctx, (items) => [...items]);
  expect(same.ok && same.value.map((i) => i.rev)).toEqual([1]);
  const changed = await changeList(ctx, (items) => items.map((i) => ({ ...i, qty: 7 })));
  expect(changed.ok && changed.value.map((i) => [i.qty, i.rev])).toEqual([[7, 2]]);
  const emptied = await changeList(ctx, () => []);
  expect(emptied).toEqual({ ok: true, value: [] });
});

it("writes only the rows that differ, deletes the rows a change dropped and reports whether any changed", async () => {
  const ctx = sim(164);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  must(await postItem.run({ name: "Eggs" }, call(ADA), ctx));
  const before = await listOf(ctx);
  if (!before.ok) throw new Error("no list");
  const tell = (after: readonly Row[]) =>
    shoppingDb(ctx).transaction(async (t) => {
      const now = await t.query(sql(Item)`select id, name, qty, bought, rev from items order by seq`);
      if (!now.ok) return now;
      return writeList(t, now.value, after);
    });
  expect(await tell(before.value)).toEqual({ ok: true, value: false });
  const [milk, eggs] = before.value;
  if (milk === undefined || eggs === undefined) throw new Error("two items expected");
  expect(await tell([{ ...milk, qty: 3 }, eggs])).toEqual({ ok: true, value: true });
  expect(await tell([{ ...milk, qty: 3 }])).toEqual({ ok: true, value: true });
  const after = await listOf(ctx);
  expect(after.ok && after.value.map((i) => [i.name, i.qty, i.rev])).toEqual([["Milk", 3, 1]]);
  expect(await tell([{ ...milk, qty: 3 }])).toEqual({ ok: true, value: false });
});

it("loads the list page for the member it is for, with the copy, the staples and the items", async () => {
  const ctx = sim(165);
  must(await postItem.run({ name: "Rice" }, call(ADA), ctx));
  const loaded = await loadList.run(read(ADA), ctx);
  expect(loaded).toMatchObject({
    ok: true,
    value: { member: ADA, text: { heading: "Shopping list" }, items: [{ name: "Rice", qty: 1 }] },
  });
  expect(loaded.ok && ListData.parse(loaded.value).ok).toBe(true);
  expect(loaded.ok && loaded.value.text.staples.map((x) => x.key)).toEqual(["milk", "bread", "eggs", "rice", "apples"]);
});

const mark = (body: unknown) => {
  const r = MarkBought.parse(body);
  if (!r.ok) throw new Error(`not a mark: ${r.error.message}`);
  return r.value;
};

it("applies a queued mark once, keeps its key to its owner, and answers a repeat with the list as it is", async () => {
  const ctx = sim(166);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  const milk = await idOf(ctx, "Milk");
  const w = (owner: string, key: string, base = 0) => ({ owner, key, base });
  const first = await markBought(ctx, milk, true, w(ADA, "k1"));
  expect(first.ok && first.value.map((i) => [i.bought, i.rev])).toEqual([[true, 1]]);
  const again = await markBought(ctx, milk, true, w(ADA, "k1"));
  expect(again.ok && again.value.map((i) => [i.bought, i.rev])).toEqual([[true, 1]]);
  const ForKey = s.object({ n: s.int() });
  const kept = await shoppingDb(ctx).one(sql(ForKey)`select count(*)::int as n from list_writes`);
  expect(kept).toEqual({ ok: true, value: { n: 1 } });
  const already = await markBought(ctx, milk, true, w(GRACE, "k1", 1));
  expect(already.ok && already.value.map((i) => [i.bought, i.rev])).toEqual([[true, 1]]);
  const other = await markBought(ctx, milk, false, w(GRACE, "k2", 1));
  expect(other.ok && other.value.map((i) => [i.bought, i.rev])).toEqual([[false, 2]]);
});

it("refuses a mark whose item changed after its writer read it, and one for an item no longer on the list, writing nothing", async () => {
  const ctx = sim(167);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  const milk = await idOf(ctx, "Milk");
  must(await toggleItem.run({}, call(GRACE, { id: milk }), ctx));
  const stale = await markBought(ctx, milk, true, { owner: ADA, key: "k1", base: 0 });
  expect(stale).toMatchObject({
    ok: false,
    error: { code: "keel.conflict", data: { transaction: "shopping.mark", head: 1 } },
  });
  const gone = await markBought(ctx, ghost, true, { owner: ADA, key: "k2", base: 0 });
  expect(gone).toMatchObject({ ok: false, error: { code: "keel.notFound" } });
  const Count = s.object({ n: s.int() });
  expect(await shoppingDb(ctx).one(sql(Count)`select count(*)::int as n from list_writes`)).toEqual({
    ok: true,
    value: { n: 0 },
  });
});

it("takes a queued mark only from the member it was queued for", async () => {
  const ctx = sim(168);
  must(await postItem.run({ name: "Milk" }, call(ADA), ctx));
  const milk = await idOf(ctx, "Milk");
  const send = (user: string, owner: string, key: string, base = 0) =>
    postBought.run(mark({ bought: true, write: { key, base, owner } }), call(user, { id: milk }), ctx);
  expect(await send(GRACE, ADA, "k1")).toMatchObject({ ok: false, error: { code: "offline.owner" } });
  expect(await send("", ADA, "k1")).toMatchObject({ ok: false, error: { code: "offline.signin" } });
  expect(await send("", "", "k1")).toMatchObject({ ok: false, error: { code: "keel.denied" } });
  expect(lines(await getItems.run(read(ADA), ctx))).toEqual(["Milk x1"]);
  expect(lines(await send(ADA, ADA, "k1"))).toEqual(["Milk x1 bought"]);
  expect(await send(ADA, ADA, "k2", 0)).toMatchObject({ ok: false, error: { code: "keel.conflict" } });
});

it("lets two members add the same name at once and ends with one open item of quantity two", async () => {
  const ctx = sim(169);
  const [a, b] = await Promise.all([
    postItem.run({ name: "Milk" }, call(ADA), ctx),
    postItem.run({ name: "Milk" }, call(GRACE), ctx),
  ]);
  expect(a.ok && b.ok).toBe(true);
  expect(lines(await getItems.run(read(ADA), ctx))).toEqual(["Milk x2"]);
});

const staples = ["Milk", "Bread"];
const stepData = (next: number) => {
  const r = RestockData.parse({ staples, next, putBack: 0, by: "member", at: "2026-06-13T08:00:00.000Z", code: "" });
  if (!r.ok) throw new Error(`not a run: ${r.error.message}`);
  return r.value;
};
const env = (key: string) => ({ signal: new AbortController().signal, key });

it("puts the run's next staple back once for each step key, however often the step runs", async () => {
  const ctx = sim(170);
  expect(await putBack(stepData(0), ctx, env("k:1:0"))).toEqual({ ok: true, value: { putBack: true } });
  expect(await putBack(stepData(0), ctx, env("k:1:0"))).toEqual({ ok: true, value: { putBack: true } });
  expect(lines(await getItems.run(read(ADA), ctx))).toEqual(["Milk x1"]);
  expect(await putBack(stepData(0), ctx, env("k:1:2"))).toEqual({ ok: true, value: { putBack: false } });
  expect(await putBack(stepData(1), ctx, env("k:1:3"))).toEqual({ ok: true, value: { putBack: true } });
  expect(await putBack(stepData(2), ctx, env("k:1:4"))).toEqual({ ok: true, value: { putBack: false } });
  expect(lines(await getItems.run(read(ADA), ctx))).toEqual(["Milk x1", "Bread x1"]);
  expect(PutBack.parse({ putBack: true }).ok).toBe(true);
  const Rows = s.object({ n: s.int() });
  expect(await shoppingDb(ctx).one(sql(Rows)`select count(*)::int as n from restocks`)).toEqual({
    ok: true,
    value: { n: 3 },
  });
  must(await shoppingDb(ctx).run(sql(NoRows)`delete from restocks`));
});

it("starts a run for a member, only one while it goes, and answers the runs as saved", async () => {
  const ctx = sim(171);
  await using(
    () => restockStores(ctx),
    async (stores) => {
      const before = await getRuns.run({ ...read(ADA), stores }, ctx);
      expect(before).toEqual({ ok: true, value: { last: null, kept: 0 } });
      const started = await postRun.run({}, { ...call(ADA), stores }, ctx);
      expect(started.ok && Runs.parse(started.value).ok).toBe(true);
      expect(started).toMatchObject({
        ok: true,
        value: { kept: 1, last: { by: "member", state: "running", total: 5, handled: 0 } },
      });
      const again = await postRun.run({}, { ...call(GRACE), stores }, ctx);
      expect(again).toMatchObject({ ok: true, value: { kept: 1 } });
      expect(await getRuns.run({ ...read(ADA), stores }, ctx)).toMatchObject({ ok: true, value: { kept: 1 } });
    },
  );
});

it("starts the weekly run from the schedule's job, once while it goes, as the schedule", async () => {
  const ctx = sim(172);
  const signal = new AbortController().signal;
  expect(startRestock.attempts).toBeGreaterThan(0);
  expect(await startRestock.fn({}, ctx, signal)).toEqual({ ok: true, value: null });
  expect(await startRestock.fn({}, ctx, signal)).toEqual({ ok: true, value: null });
  const runs = await commitStores(ctx, restockStores, (stores) => ok(runsOf(stores.restock.store.get("instances"))));
  expect(runs).toMatchObject({ ok: true, value: { kept: 1, last: { by: "schedule", state: "running" } } });
  expect(weeklyStaples).toHaveLength(5);
  expect(runners).toContain(schedules);
});

it("opens the list stream to a member only, and a visitor's open is closed denied at once", async () => {
  const ctx = sim(173);
  const open = async (loader: typeof listEvents.loader | typeof runEvents.loader, user: string) => {
    const stop = new AbortController();
    const it = loader.live({ ...read(user), signal: stop.signal }, ctx)[Symbol.asyncIterator]();
    const first = await it.next();
    stop.abort();
    await it.return?.(undefined);
    return first.value;
  };
  expect(await open(listEvents.loader, "")).toEqual({ ok: true, value: { kind: "closed", reason: "denied" } });
  expect(await open(runEvents.loader, "")).toEqual({ ok: true, value: { kind: "closed", reason: "denied" } });
  const member = await open(listEvents.loader, ADA);
  expect(member).toMatchObject({ ok: true });
  expect(member).not.toEqual({ ok: true, value: { kind: "closed", reason: "denied" } });
  expect(Object.keys(shopping.entries)).toContain("shopping.events");
});
