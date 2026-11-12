// routes.ts first: the pages import it back (E1505 cycle otherwise).
import "../modules/todos/routes.ts";
import type { Ctx } from "@keel/ctx";
import { service } from "@keel/services";
import { type A11yNode, properties, render, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { boardChannel } from "../modules/api/boardChannel.ts";
import OutboxPanel from "../modules/todos/OutboxPanel.tsx";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { boardWrites } from "../modules/todos/boardWrites.service.ts";
import { pageOrigin } from "../modules/todos/pageOrigin.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { boardOf } from "./at.ts";
import { BOARD_KEY, apiCtx, readBoard, resetApi, seedBoard, simUsers } from "./simApi.ts";
import { write } from "./write.ts";

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const bread = { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false } as const;
/** The board both users share: list Home with Milk and Bread, head 0. */
const seeded = { lists: [L], todos: [milk, bread] };
const ORIGIN = new URL(location.href).origin;
const T1 = TodoIdParams.parse({ todoId: "t1" });

/** The other user's browser: writes the board directly through the `api` deployable, with its own cookie. */
const writes = service({ base: ORIGIN, schema: boardWrites });
async function otherToggle(ctx: Ctx, key: string, base: number) {
  if (!T1.ok) throw new Error(T1.error.message);
  return writes.toggleTodo({ params: T1.value, body: { write: write(key, base) } }, ctx);
}
async function otherEdit(ctx: Ctx, title: string, key: string, base: number) {
  if (!T1.ok) throw new Error(T1.error.message);
  const body = { title, priority: "normal" as const, write: write(key, base) };
  return writes.editTodo({ params: T1.value, body }, ctx);
}

/** Id of the control a form field generated (`form<n>:<path>`), found by its accessible name. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}
const roles = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.role, ...roles(n.children)]);
const hydrations = (): number => view.log().filter((e) => e.name === "todos.hydrate").length;

/** User 0 on the edit page of Milk: goes offline, saves priority high; the outbox holds it with base `head`. */
async function offlineEdit(ctx: Parameters<typeof renderRoute>[1]["ctx"] & { net: { setOnline(b: boolean): void } }) {
  const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, ctx });
  await r.settle();
  ctx.net.setOnline(false);
  await r.fire(controlId(r.a11y(), "Priority"), { type: "input", value: "high" });
  await r.fire("todos.save", { type: "click" });
  await r.settle();
  return r;
}

describe("board channel", () => {
  it("is api.board on /api/board/events with no message", () => {
    expect([boardChannel.name, boardChannel.path, boardChannel.message]).toEqual([
      "api.board",
      "/api/board/events",
      undefined,
    ]);
  });
  it("pageOrigin is the page's origin, where the api answers", () => {
    expect(pageOrigin()).toBe(ORIGIN);
  });
});

describe("two users on one api", () => {
  it("each sees the other's writes with no input of its own", async () => {
    await seedBoard(boardOf(seeded));
    const [a, b] = await simUsers(2);
    if (a === undefined || b === undefined) throw new Error("two users");
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
    await r.settle();
    expect(r.find("todos.live").text).toBe("Live");
    const before = hydrations();
    expect((await otherToggle(b.ctx, "b1", 0)).ok).toBe(true);
    await r.settle();
    expect(r.find("todos.toggle.t1").state.checked).toBe(true);
    expect(hydrations()).toBe(before + 1);
    // User 0 writes; the other user's next read has it.
    await r.fire("todos.toggle.t2", { type: "change" });
    await r.settle();
    expect((await readBoard()).todos.map((t) => t.done)).toEqual([true, true]);
    expect(r.find("todos.toggle.t2").state.checked).toBe(true);
    r.dispose();
  });
});

describe("offline", () => {
  it("a write made offline waits in the outbox and lands on reconnect", async () => {
    await seedBoard(boardOf(seeded));
    const [a] = await simUsers(1);
    if (a === undefined) throw new Error("one user");
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
    await r.settle();
    a.ctx.net.setOnline(false);
    await r.settle();
    expect(r.find("todos.live").text).toBe("Offline");
    await r.fire("todos.toggle.t1", { type: "change" });
    await r.settle();
    const [entry] = boardOutbox.get("entries");
    expect(entry).toMatchObject({ endpoint: "toggleTodo", state: "queued", base: 0 });
    expect(r.find(`todos.outbox.state.${entry?.key}`).text).toBe("Waiting to send");
    expect(roles(r.a11y()).filter((x) => x === "complementary")).toHaveLength(1);
    expect(a.sent.filter((x) => x.startsWith("POST"))).toEqual([]);
    a.ctx.net.setOnline(true);
    await r.settle();
    expect(a.sent.filter((x) => x.startsWith("POST"))).toEqual(["POST /api/todos/t1/toggle"]);
    expect(boardOutbox.get("entries")).toEqual([]);
    expect(roles(r.a11y()).filter((x) => x === "complementary")).toEqual([]);
    expect((await readBoard()).todos[0]?.done).toBe(true);
    expect(r.find("todos.toggle.t1").state.checked).toBe(true);
    expect(r.find("todos.live").text).toBe("Live");
    r.dispose();
  });
});

describe("a refused edit", () => {
  it("shows as a conflict in the outbox panel; Keep theirs drops it and leaves the board", async () => {
    await seedBoard(boardOf(seeded));
    const [a, b] = await simUsers(2);
    if (a === undefined || b === undefined) throw new Error("two users");
    const r = await offlineEdit(a.ctx);
    expect(r.route().id).toBe("todos.list");
    expect((await otherEdit(b.ctx, "Oat milk", "b1", 0)).ok).toBe(true);
    a.ctx.net.setOnline(true);
    await r.settle();
    const [entry] = boardOutbox.get("entries");
    expect(entry).toMatchObject({ endpoint: "editTodo", state: "conflict", base: 0, head: 1 });
    const key = entry?.key ?? "";
    expect(r.find(`todos.outbox.state.${key}`).text).toBe("Someone changed this board first");
    expect(r.find(`todos.outbox.mine.${key}`)).toMatchObject({ role: "button", name: "Keep mine" });
    expect(r.find(`todos.outbox.theirs.${key}`)).toMatchObject({ role: "button", name: "Keep theirs" });
    await r.fire(`todos.outbox.theirs.${key}`, { type: "click" });
    await r.settle();
    expect(boardOutbox.get("entries")).toEqual([]);
    expect(boardOutbox.log().at(-1)).toMatchObject({
      name: "todos.outbox.resolve",
      payload: { key, resolution: "theirs" },
    });
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Oat milk", priority: "normal" });
    r.dispose();
  });
  it("Keep mine sends it again over the newer board", async () => {
    await seedBoard(boardOf(seeded));
    const [a, b] = await simUsers(2);
    if (a === undefined || b === undefined) throw new Error("two users");
    const r = await offlineEdit(a.ctx);
    expect((await otherEdit(b.ctx, "Oat milk", "b1", 0)).ok).toBe(true);
    a.ctx.net.setOnline(true);
    await r.settle();
    const key = boardOutbox.get("entries")[0]?.key ?? "";
    await r.fire(`todos.outbox.mine.${key}`, { type: "click" });
    await r.settle();
    expect(boardOutbox.get("entries")).toEqual([]);
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Milk", priority: "high" });
    expect(r.find("todos.priority.t1").text).toBe("high");
    r.dispose();
  });
});

describe("outbox panel", () => {
  it("is absent while the outbox is empty", () => {
    const t = render(OutboxPanel, { props: {} });
    expect(roles(t.a11y())).not.toContain("complementary");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(OutboxPanel);
  });
});

/** One script on fresh stores and a fresh api: user 0 toggles, goes offline, edits; user 1 edits; user 0 reconnects. */
async function script(): Promise<string> {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
  await seedBoard(boardOf(seeded));
  const [a, b] = await simUsers(2, 11);
  if (a === undefined || b === undefined) throw new Error("two users");
  const list = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
  await list.settle();
  await list.fire("todos.toggle.t2", { type: "change" });
  await list.settle();
  list.dispose();
  const r = await offlineEdit(a.ctx);
  expect((await otherEdit(b.ctx, "Oat milk", "b1", 1)).ok).toBe(true);
  a.ctx.net.setOnline(true);
  await r.settle();
  r.dispose();
  // A client store stamps its entries with a per-store counter that outlives `restore`, so `at` is left out here.
  const unstamped = (log: readonly { readonly at: number }[]) => log.map(({ at: _, ...e }) => e);
  return JSON.stringify({
    view: unstamped(view.log()),
    outbox: unstamped(boardOutbox.log()),
    sent: a.sent,
    board: await apiCtx().storage.get(BOARD_KEY),
  });
}

describe("determinism", () => {
  it("one seed gives byte-equal view, outbox and board logs", async () => {
    const first = await script();
    expect(await script()).toBe(first);
    expect(first).toContain("todos.outbox.settle");
  });
});
