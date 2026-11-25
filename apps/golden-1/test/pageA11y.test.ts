// k.a11y Render checks: each page rendered with the project's `a11y.json` and tokens, so roles and name sources
// (E1702), contrast (E1804) and reversed focus order (E1820) run beside axe-core. Each test asserts what a keyboard
// or screen reader user meets on the page: the main landmark, the headings, labelled fields and the focus order.
import { type A11yNode, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { artifacts } from "./artifacts.ts";
import { boardOf } from "./at.ts";
import { resetApi, seedBoard, simApi } from "./simApi.ts";

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
afterEach(() => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
});

const seeded = {
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true },
  ],
} as const;

/** Id of the control a form field generated (`form<n>:<path>`), found by its accessible name. */
function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** `first` comes before `then` in the page's focus order, both in it. */
function comesBefore(order: readonly string[], first: string, then: string): boolean {
  return order.includes(first) && order.includes(then) && order.indexOf(first) < order.indexOf(then);
}

describe("page accessibility", () => {
  it("todos.index: a named heading, a labelled list name, and the field before its button", async () => {
    await seedBoard(boardOf(seeded));
    const { ctx } = await simApi();
    const r = await renderRoute("todos.index", { routes, ctx, artifacts });
    try {
      expect(r.find("todos.main").role).toBe("main");
      expect(r.find("todos.nav").role).toBe("navigation");
      expect(r.a11y("todos.lists.title").role).toBe("heading");
      const name = controlId(r.a11y(), "List name");
      expect(r.find(name).role).toBe("textbox");
      expect(comesBefore(r.focusOrder(), name, "todos.addList")).toBe(true);
      // Undo is disabled with nothing to undo, so the keyboard skips it.
      expect(r.find("todos.undo").state.disabled).toBe(true);
      expect(r.focusOrder()).not.toContain("todos.undo");
    } finally {
      r.dispose();
    }
  });

  it("todos.list: the list's name as its heading; an empty add moves focus to the labelled title with its error", async () => {
    await seedBoard(boardOf(seeded));
    const { ctx } = await simApi();
    const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx, artifacts });
    try {
      expect(r.a11y("todos.list.title")).toMatchObject({ role: "heading", name: "Home" });
      const title = controlId(r.a11y(), "Title");
      expect(r.find(title).role).toBe("textbox");
      expect(comesBefore(r.focusOrder(), title, "todos.addTodo")).toBe(true);
      await r.fire("todos.addTodo", { type: "click" });
      expect(r.find(title).state.focused).toBe(true);
      expect(r.find(`${title}:error`).text).not.toBe("");
    } finally {
      r.dispose();
    }
  });

  it("todos.edit: the title field is labelled and Save follows it", async () => {
    await seedBoard(boardOf(seeded));
    const { ctx } = await simApi();
    const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, ctx, artifacts });
    try {
      expect(r.a11y("todos.edit.title").role).toBe("heading");
      const title = controlId(r.a11y(), "Title");
      expect(r.find(title).role).toBe("textbox");
      expect(r.find("todos.save")).toMatchObject({ role: "button" });
      expect(comesBefore(r.focusOrder(), title, "todos.save")).toBe(true);
    } finally {
      r.dispose();
    }
  });
});
