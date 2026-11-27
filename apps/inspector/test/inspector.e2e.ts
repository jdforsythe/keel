// The inspector over a running dev app, in a real browser under its own content security policy: golden-1 runs under
// `keel dev`, a list is added there, and the built inspector (its `node` deployable, whose loader reads the inspect
// document on the server) opened at `/?url=<golden-1's origin>` shows the live graph with its nodes grouped by kind,
// the store `todos.outbox` with the added list's queued write in its log, the ids view, and no error. Neither page
// raises a page error, a console error or a policy violation.
import { resolve } from "node:path";
import { type A11yNode, type Page, type Served, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";

const golden1 = resolve(import.meta.dirname, "..", "..", "golden-1");

/** The id of the textbox named `name` in the page's tree (a form field's id is its form's, not written in source). */
function control(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role === "textbox") return n.id;
    const inner = control(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** Whether the dev app's inspect document is live and its `todos.outbox` store has an entry in its log. */
async function outboxReported(app: Served): Promise<boolean> {
  const res = await app.fetch("/__keel/inspect", { headers: { accept: "application/json" } });
  if (res.status !== 200) return false;
  const doc: unknown = await res.json();
  if (typeof doc !== "object" || doc === null || Reflect.get(doc, "live") !== true) return false;
  const stores: unknown = Reflect.get(doc, "stores");
  const outbox: unknown =
    typeof stores === "object" && stores !== null ? Reflect.get(stores, "todos.outbox") : undefined;
  const log: unknown = typeof outbox === "object" && outbox !== null ? Reflect.get(outbox, "log") : undefined;
  return Array.isArray(log) && log.length > 0;
}

/**
 * Resolves once the page's dev entry has reported its outbox write to the dev server. The entry posts on mount and
 * then at most once a second, and the page shows nothing when a report lands, so the dev server's own document is read
 * once per `settle()` of the page (at least one animation frame apart), at most `reads` times: 600 frames are 10 s at
 * 60 frames a second, and the test's timeout bounds a slower browser.
 */
async function reported(app: Served, page: Page, reads = 600): Promise<void> {
  for (let i = 0; i < reads; i += 1, await page.settle()) if (await outboxReported(app)) return;
  throw new Error(`the dev entry did not report the outbox write in ${reads} reads`);
}

it(
  "shows a dev app's live graph by kind, its outbox store with the write in its log, and its ids",
  // Bounds starting `keel dev` for golden-1 (its first transform of every module) and the inspector's server.
  { timeout: fixedTime(180_000) },
  async () => {
    const inspector = await serve();
    const app = await serve({ project: golden1, dev: true });
    const target = app.origin();

    const page = await app.open("/");
    await page.fire(control([await page.a11y()], "List name"), { type: "input", value: "Groceries" });
    await page.fire("todos.addList", { type: "click" });
    const link = (await page.findAll("todos.listLink")).find((l) => l.text === "Groceries")?.id;
    if (link === undefined) throw new Error("no todos.listLink named Groceries after the add");
    await page.until(link, { text: "Groceries" });
    await reported(app, page);

    const view = await inspector.open(`/?url=${encodeURIComponent(target)}`);
    await view.find("inspector.graph");
    expect(await view.findAll("inspector.error")).toEqual([]);
    expect((await view.find("inspector.title")).text).toBe(`Inspector: ${target}`);

    const live = (await view.find("inspector.live")).text;
    expect(live).not.toMatch(/not live|offline/i);

    expect((await view.find("inspector.graph.counts")).text).toMatch(/^[1-9]\d* nodes, \d+ edges$/);
    const kinds = (await view.findAll("inspector.graph")).filter(
      (f) => f.id.endsWith(".title") && f.id !== "inspector.graph.title",
    );
    expect(kinds.length).toBeGreaterThan(0);

    // The store's log as the view counts it, and one entry shown per entry counted: a view that always says the log is
    // empty, or that counts what it does not show, fails here.
    const count = (await view.find("inspector.store.todos.outbox.count")).text;
    expect(count).toMatch(/^Log: [1-9]\d* entries$/);
    const entries = await view.findAll("inspector.store.todos.outbox.entry");
    expect(entries).toHaveLength(Number(/\d+/.exec(count)?.[0]));
    expect(entries.some((e) => e.text.includes("outbox.add"))).toBe(true);

    expect((await view.find("inspector.ids.counts")).text).not.toBe("");
    expect((await view.findAll("inspector.id")).length).toBeGreaterThan(0);

    expect(page.problems()).toEqual([]);
    expect(view.problems()).toEqual([]);
  },
);
