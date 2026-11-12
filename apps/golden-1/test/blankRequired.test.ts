import { type A11yNode, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { boardOf } from "./at.ts";
import { apiApp, readBoard, resetApi, seedBoard, simApi } from "./simApi.ts";

const shown = view.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
});

const L = { id: "l1", name: "Home" };
const milk = { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false } as const;
const seeded = { lists: [L], todos: [milk] };
const BLANKS = ["", " ", "   ", "\t \n"];

/** Id of the control a form field generated (`form<n>:<path>`), found by its accessible name. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("blank required text", () => {
  it("a blank or whitespace-only list name shows Required and adds no list", async () => {
    for (const value of BLANKS) {
      await seedBoard(boardOf(seeded));
      const { ctx, sent } = await simApi();
      const r = await renderRoute("todos.index", { routes, ctx });
      const name = controlId(r.a11y(), "List name");
      await r.fire(name, { type: "input", value });
      await r.fire("todos.addList", { type: "click" });
      expect(r.find(`${name}:error`).text).toBe("Required");
      expect((await readBoard()).lists).toEqual([L]);
      expect(sent.filter((x) => x.startsWith("POST"))).toEqual([]);
      r.dispose();
      resetApi();
    }
  });

  it("a blank or whitespace-only todo title shows Required and adds no row", async () => {
    for (const value of BLANKS) {
      await seedBoard(boardOf(seeded));
      const { ctx, sent } = await simApi();
      const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
      const title = controlId(r.a11y(), "Title");
      await r.fire(title, { type: "input", value });
      await r.fire("todos.addTodo", { type: "click" });
      expect(r.find(`${title}:error`).text).toBe("Required");
      expect((await readBoard()).todos).toEqual([milk]);
      expect(r.state(view).todos.map((t) => t.title)).toEqual(["Milk"]);
      expect(sent.filter((x) => x.startsWith("POST"))).toEqual([]);
      r.dispose();
      resetApi();
    }
  });

  it("the add form and the edit form show the same message for an empty title", async () => {
    await seedBoard(boardOf(seeded));
    const add = await simApi();
    const list = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: add.ctx });
    const addTitle = controlId(list.a11y(), "Title");
    await list.fire(addTitle, { type: "input", value: "" });
    await list.fire("todos.addTodo", { type: "click" });
    const addMessage = list.find(`${addTitle}:error`).text;
    list.dispose();

    const edit = await simApi();
    const page = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, ctx: edit.ctx });
    const editTitle = controlId(page.a11y(), "Title");
    await page.fire(editTitle, { type: "input", value: "" });
    await page.fire("todos.save", { type: "click" });
    expect(page.find(`${editTitle}:error`).text).toBe(addMessage);
    expect(addMessage).toBe("Required");
    expect((await readBoard()).todos).toEqual([milk]);
    page.dispose();
  });

  it("the api refuses a whitespace-only list name and todo title and keeps the board", async () => {
    await seedBoard(boardOf(seeded));
    const app = await apiApp();
    for (const value of BLANKS) {
      expect((await app.fetch(post("/api/lists", { name: value }))).status).toBe(422);
      expect((await app.fetch(post("/api/lists/l1/todos", { title: value, priority: "low" }))).status).toBe(422);
      expect((await app.fetch(post("/api/todos/t1", { title: value, priority: "low" }))).status).toBe(422);
    }
    expect(await readBoard()).toEqual(boardOf(seeded));
  });
});
