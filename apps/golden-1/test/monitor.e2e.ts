// The two-user board script of golden-1, built, in two browser contexts: user 0 makes a board and marks Milk done, user
// 1 sees it live, goes offline, saves an edit and marks Bread done, user 0 renames Milk, and on reconnect the toggle
// lands, the edit is refused as a conflict and Keep theirs drops it from the outbox. The api's `readers` holds a fresh
// reader, so once the api's runner has merged a tally (every 60 s of its clock) `GET /sessions/tally` answers that
// reader, and `keel session monitor` writes what it read.
import { execFile } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { scope } from "@keel/reactive";
import { store } from "@keel/store";
import { type A11yNode, type Page, type Served, build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, it } from "vitest";
import { Board } from "../modules/api/Board.schema.ts";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(here, "..", "..", "packages", "cli", "src", "bin.ts");
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage"]);

// The api's board store, used as the clock of the wait for a tally: its handle is made in a detached root of the file's own.
const board = scope(() => undefined, { detached: true }).run(() =>
  store(Board, { lists: [], todos: [] }, { id: "api.board" }),
);

/** The field at `keys` of `value`, `undefined` where a step is not an object. */
function field(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), value);
}

/** A copy of the app in a temporary folder whose api admits `reader`, not yet built. */
async function copyWithReader(reader: string): Promise<string> {
  const tmp = tempDir("keel-e2e-monitor-");
  const dir = join(tmp, "app");
  // No `test/`: the copy is built alone, and vitest resolves from the workspace root, not from the copy.
  await cp(here, dir, {
    recursive: true,
    filter: (src) => src === here || (src !== join(here, "test") && !SKIP.has(basename(src))),
  });
  await symlink(join(here, "node_modules"), join(dir, "node_modules"), "dir");
  const manifest = join(dir, "modules", "api", "module.ts");
  const text = await readFile(manifest, "utf8");
  const next = text.replace(/readers: \[[^\]]*\]/, `readers: [${JSON.stringify(reader)}]`);
  if (next === text) throw new Error("the api's manifest has no readers list");
  await writeFile(manifest, next);
  return tmp;
}

/** Whether `GET /sessions/tally` answered by `cookie` holds a merged transaction, by the last answer read. */
async function tallyMerged(app: Served, cookie: string): Promise<boolean> {
  const res = await app.fetch("/sessions/tally", {
    headers: { accept: "application/json", cookie: `keel-caller=${cookie}` },
  });
  if (!res.ok) return false;
  const tx = field(await res.json(), "results", "sessions.tally", "value", "tx");
  return typeof tx === "object" && tx !== null && Object.keys(tx).length > 0;
}

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

// The build of a copy, the browsers' script and one merge window of the api's clock (60 s) are the app's own time.
it(
  "a toggle made offline lands, a refused offline edit is dropped by Keep theirs, in two contexts, and the tally of the run is read by `keel session monitor`",
  { timeout: fixedTime(300_000) },
  async () => {
    // A reader the api admits: a caller cookie signed under the serve's secret, hashed as the api hashes a caller cookie.
    const secret = randomBytes(32).toString("base64url");
    const token = randomUUID();
    const cookie = `${token}.${createHmac("sha256", secret).update(token).digest("base64url")}`;
    const reader = createHash("sha256").update(cookie).digest("base64url");
    const tmp = await copyWithReader(reader);
    try {
      const dir = join(tmp, "app");
      await build(dir);
      const app = await serve({ project: dir, env: { KEEL_SECRET: secret } });
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

      // The offline requests failed in the browser: user 1's page takes those console errors and the refused edit's 409 and nothing else, so any
      // other problem (a rejection no code handled) is left and fails the test with E1738.
      expect(u1.problems({ kind: "console", text: "ERR_INTERNET_DISCONNECTED" }).length).toBeGreaterThan(0);
      // The refused edit's answer, which the browser logs: the conflict the test made.
      expect(u1.problems({ kind: "console", text: "status of 409 (Conflict)" })).toHaveLength(1);
      expect(u1.problems()).toEqual([]);
      expect(u0.problems()).toEqual([]);

      // tally merged: the api's runner writes `sessions.tally` every 60 s of its clock. The storage key is no store's, so
      // each read of the `until` below (every 100 ms) starts one request for the tally and the test reads the last answer.
      let merged = false;
      let asking = false;
      let failure: unknown;
      await app.until(
        board,
        () => {
          if (!merged && !asking) {
            asking = true;
            tallyMerged(app, cookie).then(
              (m) => {
                merged = m;
                asking = false;
              },
              (e: unknown) => {
                failure = e;
                asking = false;
              },
            );
          }
          return merged || failure !== undefined;
        },
        { fixed: 60_000, within: 30_000 },
      );
      expect(failure).toBeUndefined();
      expect(merged).toBe(true);

      // session monitor: `keel session monitor` reads the tally as the reader and writes it.
      const out = "monitored.json";
      const origin = app.origin();
      const run = await promisify(execFile)("node", [cli, "session", "monitor", origin, "--out", out], {
        cwd: dir,
        env: { ...process.env, KEEL_SESSIONS_TOKEN: cookie },
      });
      const said = run.stdout.trim().split("\n");
      expect(said[0]).toMatch(/^ok session monitor [1-9]\d* transactions, [1-9]\d* runs/);
      const written: unknown = JSON.parse(await readFile(join(dir, out), "utf8"));
      expect(field(written, "v")).toBe(1);
      expect(field(written, "origin")).toBe(origin);
      const tx = field(written, "tx");
      expect(Object.keys(Object(tx)).length).toBeGreaterThan(0);
      expect(Object.values(Object(tx)).every((n) => Number.isInteger(n) && Number(n) > 0)).toBe(true);
      expect(Number(field(written, "from"))).toBeLessThanOrEqual(Number(field(written, "to")));

      // The api drains: it stops listening and exits with code 0.
      await app.stop("api", { drain: true });
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);
