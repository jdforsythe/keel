// Golden-1's data lives behind its api, in a real browser against the built server: a list is created, survives a
// reload, is opened, gets a todo that survives a reload, which is toggled and the toggle undone, and the undo survives
// a reload. After each write the page waits for its own answer (fire resolves once the page is quiet), and the api's
// stored board holds the list and the todo. No page or console error is raised (an unread one fails the test).
import { scope } from "@keel/reactive";
import { store } from "@keel/store";
import { type A11yNode, type Page, serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";
import { Board } from "../modules/api/Board.schema.ts";

// The api's board store, named for `state`: its id and schema, made in a scope of the file's own.
const board = scope(() => undefined).run(() => store(Board, { lists: [], todos: [] }, { id: "api.board" }));

/** The id of the control named `name` in the page's tree (a form field's id is its form's, not written in source). */
function control(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role === "textbox") return n.id;
    const inner = control(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** The id under `prefix` whose text is `text`, once it is shown. */
async function keyed(page: Page, prefix: string, name: string): Promise<string> {
  const rows = await page.findAll(prefix);
  const row = rows.find((r) => r.name === name || r.text === name);
  if (row === undefined) throw new Error(`no ${prefix} named ${name}: ${rows.map((r) => r.name).join(", ")}`);
  return row.id;
}

it("a list and a todo survive reloads, a toggle and its undo reach the api, and the board row holds them", async () => {
  const app = await serve();
  const page = await app.open("/");
  const name = `Persist ${process.pid}`;
  const posts = (suffix: string): number[] =>
    app
      .serverLog("api")
      .flatMap((r) => (r.kind === "req" && r.method === "POST" && r.path.endsWith(suffix) ? [r.status] : []));

  await page.fire(control([await page.a11y()], "List name"), { type: "input", value: name });
  await page.fire("todos.addList", { type: "click" });
  expect(posts("/api/lists")).toEqual([200]);
  const link = await keyed(page, "todos.listLink", name);

  await page.reload();
  await page.until(link, { text: name });

  await page.fire(link, { type: "click" });
  await page.until("todos.list.title", { text: name });
  expect((await page.location()).path).toMatch(/^\/lists\//);

  await page.fire(control([await page.a11y()], "Title"), { type: "input", value: "Milk" });
  await page.fire("todos.addTodo", { type: "click" });
  expect(posts("/todos")).toEqual([200]);
  const box = await keyed(page, "todos.toggle", "Done: Milk");

  await page.reload();
  await page.until(box, { name: "Done: Milk" });
  expect((await page.find("todos.list.title")).text).toBe(name);
  expect(await page.findAll("todos.toggle")).toHaveLength(1);

  await page.fire(box, { type: "click" });
  await page.until(box, { state: { checked: true } });
  expect(posts("/toggle")).toEqual([200]);

  await page.fire("todos.undo", { type: "click" });
  await page.until(box, { state: { checked: false } });
  expect(posts("/api/undo")).toEqual([200]);

  await page.reload();
  await page.until(box, { state: { checked: false } });

  const stored = await app.state(board);
  expect(stored.lists.map((l) => l.name)).toContain(name);
  expect(stored.todos.map((t) => t.title)).toContain("Milk");
});
