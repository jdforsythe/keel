import type { SimCtx } from "@keel/ctx";
import { service } from "@keel/services";
import { type A11yNode, render, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { api } from "../modules/api/api.contract.ts";
import EditTodoPage from "../modules/todos/EditTodoPage.tsx";
import OutboxPanel from "../modules/todos/OutboxPanel.tsx";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { editorChart } from "../modules/todos/editorChart.ts";
import { editorFollow } from "../modules/todos/editorFollow.ts";
import { editorOutcome } from "../modules/todos/editorOutcome.ts";
import { editorStuck } from "../modules/todos/editorStuck.ts";
import { resolveEdit } from "../modules/todos/resolveEdit.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { boardOf } from "./at.ts";
import { readBoard, resetApi, seedBoard, simUsers } from "./simApi.ts";
import { write } from "./write.ts";

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
const viewing = editorChart.store.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
  expect(editorChart.store.restore(viewing).ok).toBe(true);
});

const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const seeded = { lists: [{ id: "l1", name: "Home" }], todos: [milk] };
const T1 = TodoIdParams.parse({ todoId: "t1" });
const params = { listId: "l1", todoId: "t1" };
const chartNow = () => ({ state: editorChart.store.get("state"), data: editorChart.store.get("data") });
/** Put the chart in `state` with `attempts` tries, as a run of events would. */
const chartAt = (state: "viewing" | "saving" | "conflict" | "gaveUp", attempts: number) => {
  const value = { state, data: { attempts } };
  expect(editorChart.store.restore({ state: value, initial: value, log: [] }).ok).toBe(true);
};

/** Another user's edit of Milk, straight to the api: the board moves on under the editor. */
async function otherEdit(ctx: SimCtx) {
  if (!T1.ok) throw new Error(T1.error.message);
  const body = { title: "Oat milk", priority: "normal" as const, write: write("b1", 0) };
  return service({ contract: api }).editTodo({ params: T1.value, body }, ctx);
}

/** Id of the control a form field generated, found by its accessible name. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** The editor on Milk's page, offline, saving priority high: the outbox holds it and the chart waits in `saving`. */
async function offlineSave(ctx: SimCtx) {
  const r = await renderRoute("todos.edit", { routes, params, ctx });
  await r.settle();
  ctx.net.setOnline(false);
  await r.fire(controlId(r.a11y(), "Priority"), { type: "input", value: "high" });
  await r.fire("todos.save", { type: "click" });
  await r.settle();
  return r;
}

describe("the edit page on editorChart", () => {
  it("opening the page is edit; a sent save is saved, back to viewing with no tries", async () => {
    await seedBoard(boardOf(seeded));
    const [a] = await simUsers(1);
    if (a === undefined) throw new Error("one user");
    const r = await renderRoute("todos.edit", { routes, params, ctx: a.ctx });
    expect(chartNow()).toEqual({ state: "editing", data: { attempts: 0 } });
    await r.fire("todos.save", { type: "click" });
    expect(chartNow()).toEqual({ state: "viewing", data: { attempts: 0 } });
    expect(editorChart.store.log().map((e) => e.name)).toEqual([
      "todos.editor.edit",
      "todos.editor.save",
      "todos.editor.saved",
    ]);
    r.dispose();
  });

  it("an offline save waits in saving; refused on reconnect, Keep theirs returns to viewing", async () => {
    await seedBoard(boardOf(seeded));
    const [a, b] = await simUsers(2);
    if (a === undefined || b === undefined) throw new Error("two users");
    const r = await offlineSave(a.ctx);
    expect(chartNow()).toEqual({ state: "saving", data: { attempts: 1 } });
    expect((await otherEdit(b.ctx)).ok).toBe(true);
    a.ctx.net.setOnline(true);
    await r.settle();
    const key = boardOutbox.get("entries")[0]?.key ?? "";
    expect(r.find(`todos.outbox.mine.${key}`).state.disabled ?? false).toBe(false);
    await r.fire(`todos.outbox.theirs.${key}`, { type: "click" });
    await r.settle();
    expect(chartNow()).toEqual({ state: "viewing", data: { attempts: 0 } });
    expect(boardOutbox.get("entries")).toEqual([]);
    r.dispose();
  });

  it("Keep mine sends the refused edit again within the tries and returns once the chart has followed the answer", async () => {
    await seedBoard(boardOf(seeded));
    const [a, b] = await simUsers(2);
    if (a === undefined || b === undefined) throw new Error("two users");
    const r = await offlineSave(a.ctx);
    expect((await otherEdit(b.ctx)).ok).toBe(true);
    a.ctx.net.setOnline(true);
    await r.settle();
    const key = boardOutbox.get("entries")[0]?.key ?? "";
    expect(await resolveEdit(a.ctx, key, "mine")).toBe(true);
    await r.settle();
    expect(boardOutbox.get("entries")).toEqual([]);
    expect(chartNow()).toEqual({ state: "viewing", data: { attempts: 0 } });
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Milk", priority: "high" });
    r.dispose();
    const again = await renderRoute("todos.edit", { routes, params, ctx: a.ctx });
    expect(chartNow()).toEqual({ state: "editing", data: { attempts: 0 } });
    expect(
      editorChart.store
        .log()
        .map((e) => e.name)
        .slice(-2),
    ).toEqual(["todos.editor.saved", "todos.editor.edit"]);
    again.dispose();
  });

  it("a refused edit that used its 3 tries turns Keep mine off and leaves Keep theirs", async () => {
    chartAt("conflict", 3);
    expect(editorStuck()).toBe(true);
    const entry = {
      key: "w1",
      endpoint: "editTodo",
      owner: "",
      input: { params: { todoId: "t1" }, body: { title: "Milk", priority: "high" } },
      base: 0,
      at: 0,
      state: "conflict",
      head: 1,
    };
    const held = { entries: [entry] };
    expect(boardOutbox.restore({ state: held, initial: held, log: [] }).ok).toBe(true);
    const t = render(OutboxPanel, { props: {} });
    expect(t.find("todos.outbox.mine.w1").state.disabled).toBe(true);
    expect(t.find("todos.outbox.theirs.w1").state.disabled ?? false).toBe(false);
    t.dispose();
    chartAt("conflict", 2);
    expect(editorStuck()).toBe(false);
  });
});

describe("editorOutcome", () => {
  it("sent is saved, conflict refused, failed failed; queued and sending leave saving", () => {
    chartAt("saving", 1);
    expect(editorOutcome("queued").ok).toBe(true);
    expect(editorOutcome("sending").ok).toBe(true);
    expect(chartNow()).toEqual({ state: "saving", data: { attempts: 1 } });
    expect(editorOutcome("failed").ok).toBe(true);
    expect(chartNow()).toEqual({ state: "saving", data: { attempts: 2 } });
    expect(editorOutcome("conflict").ok).toBe(true);
    expect(chartNow()).toEqual({ state: "conflict", data: { attempts: 2 } });
    chartAt("saving", 3);
    expect(editorOutcome("failed").ok).toBe(true);
    expect(chartNow().state).toBe("gaveUp");
    chartAt("saving", 1);
    expect(editorOutcome("sent").ok).toBe(true);
    expect(chartNow()).toEqual({ state: "viewing", data: { attempts: 0 } });
  });
});

describe("editorFollow", () => {
  it("an edit the outbox no longer holds is saved; a held one follows its entry; other states stay", () => {
    chartAt("saving", 1);
    expect(editorFollow().ok).toBe(true);
    expect(chartNow()).toEqual({ state: "viewing", data: { attempts: 0 } });
    const entry = {
      key: "w1",
      endpoint: "editTodo",
      owner: "",
      input: { params: { todoId: "t1" }, body: { title: "Milk", priority: "high" } },
      base: 0,
      at: 0,
      state: "conflict",
      head: 1,
    };
    const held = { entries: [entry] };
    expect(boardOutbox.restore({ state: held, initial: held, log: [] }).ok).toBe(true);
    chartAt("saving", 1);
    expect(editorFollow().ok).toBe(true);
    expect(chartNow()).toEqual({ state: "conflict", data: { attempts: 1 } });
    chartAt("gaveUp", 3);
    expect(editorFollow().ok).toBe(true);
    expect(chartNow().state).toBe("gaveUp");
  });
});

describe("EditTodoPage status", () => {
  it("is a status region from the first render, filled when a save fails (E1826)", async () => {
    chartAt("viewing", 0);
    const t = render(EditTodoPage, { props: { params, data: milk } });
    expect(t.find("todos.edit.status")).toMatchObject({ role: "status", text: "" });
    chartAt("saving", 2);
    await t.settle();
    expect(t.find("todos.edit.status").text).toBe("Not saved. Save to try again.");
    t.dispose();
  });

  it("names a failed try, a refused edit and a given-up one; Save is off for the last two", () => {
    const page = (state: "viewing" | "saving" | "conflict" | "gaveUp", attempts: number) =>
      render(EditTodoPage, {
        props: { params, data: milk },
        state: [[editorChart.store, { state, data: { attempts } }]],
      });
    const quiet = page("viewing", 0);
    expect(quiet.a11y().length).toBeGreaterThan(0);
    expect(quiet.find("todos.edit.status").text).toBe("");
    expect(quiet.find("todos.save").state.disabled ?? false).toBe(false);
    quiet.dispose();
    const retry = page("saving", 2);
    expect(retry.find("todos.edit.status").text).toBe("Not saved. Save to try again.");
    expect(retry.find("todos.save").state.disabled ?? false).toBe(false);
    retry.dispose();
    const refused = page("conflict", 1);
    expect(refused.find("todos.edit.status").text).toBe(
      "Someone changed this todo first. Choose Keep mine or Keep theirs in the outbox.",
    );
    expect(refused.find("todos.save").state.disabled).toBe(true);
    refused.dispose();
    const done = page("gaveUp", 3);
    expect(done.find("todos.edit.status").text).toBe("Not saved after 3 tries. Reload the page to edit again.");
    expect(done.find("todos.save").state.disabled).toBe(true);
    done.dispose();
  });
});
