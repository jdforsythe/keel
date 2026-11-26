// The two-user board script of golden-1, built, in two browser contexts: user 0 makes a board and marks Milk done, user
// 1 sees it live, goes offline, saves an edit and marks Bread done, user 0 renames Milk, and on reconnect the toggle
// lands, the edit is refused as a conflict and Keep theirs drops it from the outbox.
import { type A11yNode, type Page, serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

/** The id of the control named `name` with `role` in the page's tree (a form field's id is its form's, not in source). */
function control(nodes: readonly A11yNode[], role: string, name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role === role) return n.id;
    const inner = control(n.children, role, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** The id under `prefix` whose name or text is `name`, once it is shown. */
async function keyed(page: Page, prefix: string, name: string): Promise<string> {
  const rows = await page.findAll(prefix);
  const row = rows.find((r) => r.name === name || r.text === name);
  if (row === undefined)
    throw new Error(`no ${prefix} named ${name}: ${rows.map((r) => `${r.name}|${r.text}`).join(", ")}`);
  return row.id;
}

/** A todo added on the list page, and the id of its Done checkbox once it is shown. */
async function addTodo(page: Page, title: string): Promise<string> {
  await page.fire(control([await page.a11y()], "textbox", "Title"), { type: "input", value: title });
  await page.fire("todos.addTodo", { type: "click" });
  return keyed(page, "todos.toggle", `Done: ${title}`);
}

it("a toggle made offline lands, a refused offline edit is dropped by Keep theirs, in two contexts", async () => {
  const app = await serve();
  const u0 = await app.open("/");
  // The board stream stays open: the page shows Live once it is connected.
  await u0.until("todos.live", { text: /Live/ });

  // board: user 0 makes Home with Milk and Bread.
  await u0.fire(control([await u0.a11y()], "textbox", "List name"), { type: "input", value: "Home" });
  await u0.fire("todos.addList", { type: "click" });
  await u0.fire(await keyed(u0, "todos.listLink", "Home"), { type: "click" });
  await u0.until("todos.list.title", { text: "Home" });
  const milk = await addTodo(u0, "Milk");
  const bread0 = await addTodo(u0, "Bread");
  expect(bread0).not.toBe("");
  const list = (await u0.location()).path;
  expect(list).toMatch(/^\/lists\//);

  // live toggle: both on the list; user 0 marks Milk done and user 1 sees it with no input of its own.
  const u1 = await app.open(list);
  await u1.until("todos.live", { text: /Live/ });
  await u0.fire(milk, { type: "click" });
  await u1.until(await keyed(u1, "todos.toggle", "Done: Milk"), { state: { checked: true } });

  // offline writes: user 1 opens Milk's edit page, goes offline, saves priority high and marks Bread done: both wait.
  await u1.fire(await keyed(u1, "todos.editLink", "Edit Milk"), { type: "click" });
  await u1.find("todos.save");
  await u1.offline(true);
  await u1.fire(control([await u1.a11y()], "combobox", "Priority"), { type: "change", value: "high" });
  await u1.fire("todos.save", { type: "click" });
  const bread1 = await keyed(u1, "todos.toggle", "Done: Bread");
  await u1.fire(bread1, { type: "click" });
  await u1.find("todos.outbox");

  // rename and add: user 0 renames Milk to Oat milk and adds Eggs.
  await u0.fire(await keyed(u0, "todos.editLink", "Edit Milk"), { type: "click" });
  await u0.find("todos.save");
  await u0.fire(control([await u0.a11y()], "textbox", "Title"), { type: "input", value: "Oat milk" });
  await u0.fire("todos.save", { type: "click" });
  await u0.until(await keyed(u0, "todos.toggle", "Done: Oat milk"), { name: "Done: Oat milk" });
  await addTodo(u0, "Eggs");

  // conflict kept theirs: user 1 comes back, the toggle lands, the edit is refused; Keep theirs drops it.
  await u1.offline(false);
  const edit = (await u1.findAll("todos.outbox.state"))[0];
  expect(edit?.id).toBeDefined();
  await u1.until(edit?.id ?? "", { text: "Someone changed this board first" });
  const theirs = await u1.findAll("todos.outbox.theirs");
  expect(theirs).toHaveLength(1);
  await u1.fire(theirs[0]?.id ?? "", { type: "click" });
  await u1.until("todos.outbox", { gone: true });

  // The offline requests failed in the browser: they are the problems user 1's page read.
  expect((await u1.problems()).length).toBeGreaterThan(0);
  expect(await u0.problems()).toEqual([]);
});
