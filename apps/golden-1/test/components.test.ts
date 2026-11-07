import { createCtx } from "@keel/ctx";
import { service } from "@keel/services";
import { properties, render } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import AppShell from "../modules/todos/AppShell.tsx";
import EditTodoPage from "../modules/todos/EditTodoPage.tsx";
import ListError from "../modules/todos/ListError.tsx";
import ListPage from "../modules/todos/ListPage.tsx";
import ListsPage from "../modules/todos/ListsPage.tsx";
import Suggestions from "../modules/todos/Suggestions.tsx";
import TodoRow from "../modules/todos/TodoRow.tsx";
import { suggestions } from "../modules/todos/suggestions.service.ts";
import { view } from "../modules/todos/view.ts";
import { boardOf } from "./at.ts";
import { resetApi, seedBoard, simApi } from "./simApi.ts";
import "../modules/todos/routes.ts";

const shown = view.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "high", done: true };
const SUGGESTIONS = new URL("/api/suggestions", location.href).href;
/** What the `api` deployable answers a runtime GET with (k.server): the `api.suggestions` loader `Result`. */
const served = (titles: string[]) =>
  new Response(
    JSON.stringify({
      id: "api.suggestions",
      results: { "api.suggestions": { ok: true, value: titles.map((title) => ({ title })) } },
    }),
  );

describe("TodoRow", () => {
  it("shows done, priority and an edit link", () => {
    const t = render(TodoRow, { props: { todo: milk } });
    expect(t.find("todos.toggle.t1")).toMatchObject({ role: "checkbox", name: "Done: Milk", state: { checked: true } });
    expect(t.find("todos.priority.t1").text).toBe("high");
    expect(t.find("todos.editLink.t1").name).toBe("Edit");
    t.dispose();
  });
  it("the checkbox posts the toggle to the api and the row shows the re-read board", async () => {
    const seed = { lists: [L], todos: [{ ...milk, done: false }] };
    await seedBoard(boardOf(seed));
    const { ctx, sent } = await simApi();
    const t = render(TodoRow, { props: { todo: { ...milk, done: false } }, ctx });
    await t.fire("todos.toggle.t1", { type: "change" });
    await t.settle();
    expect(sent).toEqual(["POST /api/todos/t1/toggle", "GET /api/lists"]);
    expect(t.state(view).todos[0]?.done).toBe(true);
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(TodoRow);
  });
});

describe("AppShell", () => {
  it("Undo is disabled until the api reports something to undo, then posts /api/undo", async () => {
    const { ctx, sent } = await simApi();
    const t = render(AppShell, { props: {}, ctx });
    expect(t.find("todos.undo").state.disabled).toBe(true);
    const value = { lists: [L], todos: [], canUndo: true };
    const t2 = render(AppShell, { props: {}, ctx, state: [[view, value]] });
    expect(t2.find("todos.undo").state.disabled).toBeUndefined();
    await t2.fire("todos.undo", { type: "click" });
    await t2.settle();
    expect(sent).toEqual(["POST /api/undo", "GET /api/lists"]);
    expect(t2.state(view).canUndo).toBe(false);
    t2.dispose();
    t.dispose();
  });
});

describe("Suggestions", () => {
  it("goes loading to ready", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => served(["Eggs", "Bread"]));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.settle();
    expect(t.find("todos.suggestions.list").text).toBe("EggsBread");
    t.dispose();
  });
  it("goes loading to error on a sim 500", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => new Response("boom", { status: 500 }));
    const t = render(Suggestions, { props: {}, ctx });
    expect(t.find("todos.suggestions.loading").text).toBe("Loading suggestions");
    await t.settle();
    expect(t.find("todos.suggestions.error").text).toBe("Suggestions failed (500)");
    t.dispose();
  });
  it("goes loading to error when the body is not the api.suggestions Result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(SUGGESTIONS, () => new Response(JSON.stringify([{ title: "Eggs" }])));
    const t = render(Suggestions, { props: {}, ctx });
    await t.settle();
    expect(t.find("todos.suggestions.error").text).toBe("Suggestions failed");
    t.dispose();
  });
  it("holds its properties", async () => {
    await properties(Suggestions);
  });
});

describe("suggestions", () => {
  it("lists through ctx.net with accept: application/json and decodes the Result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const accepts: (string | null)[] = [];
    ctx.net.route(SUGGESTIONS, (req) => {
      accepts.push(req.headers.get("accept"));
      return served(["Milk"]);
    });
    const r = await service({ base: location.origin, schema: suggestions }).list({}, ctx);
    expect(r.ok && r.value.results["api.suggestions"].value).toEqual([{ title: "Milk" }]);
    expect(accepts).toEqual(["application/json"]);
  });
});
