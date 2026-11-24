// Browser proof that golden-1's data lives behind its api: a copy of the app is built in a temporary folder, its `api`
// `server.mjs` (which also serves the web client) runs on a free port over a SQLite file there, and headless Chromium
// creates a list, reloads and finds it, opens it, adds a todo, reloads and finds it, toggles it, undoes the toggle and
// reloads once more: after each write the page waits for the api's answer to that write, and after each reload for the
// element the step needs, never for an idle network (the list page keeps an event stream open). The api's stored board
// row holds the list and the todo, and no page error or console error is raised.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/persist.mjs [png]. Nothing is written inside the
// repo; the server and the browser are stopped on every path, and a crash prints the steps it had.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { BOARD_KEY, buildCopy, freePort, keepOutput, ready, recorder, row, serve, stop } from "./built.mjs";

const { step, finish, caught } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-persist-"));
const name = `Persist ${process.pid}`;
const errors = [];
let server;
let browser;
try {
  step("build", await buildCopy(join(tmp, "app")));
  const file = join(tmp, "data", "keel.sqlite");
  await mkdir(join(tmp, "data"));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  server = serve(join(tmp, "app"), file, port);
  const up = await ready(`http://127.0.0.1:${port}`);
  step("serve", up);
  if (!up) throw new Error(`server did not answer: ${server.log.slice(-3).join(" | ")}`);

  browser = await chromium.launch();
  const p = await browser.newPage();
  keepOutput("page errors", errors);
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const box = () => p.getByRole("checkbox", { name: "Done: Milk" });
  const listLink = () => p.getByRole("link", { name, exact: true });
  /** Run `act` and resolve once the api has answered the POST whose path ends in `suffix`; its status. */
  const answered = async (suffix, act) => {
    const [r] = await Promise.all([
      p.waitForResponse((x) => x.request().method() === "POST" && new URL(x.url()).pathname.endsWith(suffix), {
        timeout: 10_000,
      }),
      act(),
    ]);
    return r.status();
  };
  const checkedIs = (want) =>
    p.waitForFunction((w) => document.querySelector('input[type="checkbox"]')?.checked === w, want, { timeout: 5_000 });

  await p.goto(url, { waitUntil: "load" });
  await p.getByLabel("List name").fill(name);
  const created = await answered("/api/lists", () => p.click("#todos\\.addList"));
  await listLink().waitFor({ timeout: 5_000 });
  step("create list", created === 200, JSON.stringify(name));

  await p.reload({ waitUntil: "load" });
  await listLink().waitFor({ timeout: 10_000 });
  step("list after reload", (await listLink().count()) === 1);

  await listLink().click();
  await p.locator("#todos\\.list\\.title", { hasText: name }).waitFor({ timeout: 5_000 });
  const listUrl = new URL(p.url()).pathname;
  step("open list", listUrl.startsWith("/lists/"), listUrl);

  await p.getByLabel("Title").fill("Milk");
  const added = await answered("/todos", () => p.click("#todos\\.addTodo"));
  await box().waitFor({ timeout: 5_000 });
  step("add todo", added === 200);

  await p.reload({ waitUntil: "load" });
  await box().waitFor({ timeout: 10_000 });
  const title = await p.locator("#todos\\.list\\.title").innerText();
  step("todo after reload", title === name && (await box().count()) === 1, new URL(p.url()).pathname);

  const toggled = await answered("/toggle", () => box().click());
  await checkedIs(true);
  step("toggle", toggled === 200 && (await box().isChecked()));

  const undone = await answered("/api/undo", () => p.click("#todos\\.undo"));
  await checkedIs(false);
  step("undo", undone === 200 && !(await box().isChecked()));

  await p.reload({ waitUntil: "load" });
  await box().waitFor({ timeout: 10_000 });
  step("undo after reload", !(await box().isChecked()));

  const stored = row(file, BOARD_KEY) ?? "";
  step("stored row", stored.includes(name) && stored.includes("Milk"));
  if (process.argv[2] !== undefined) await p.screenshot({ path: process.argv[2], fullPage: true });
  step("no page error", errors.length === 0, errors.map((e) => e.split("\n")[0]).join(" | "));
} catch (e) {
  caught(e);
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await browser?.close().catch(() => undefined);
  await stop(server);
  await rm(tmp, { recursive: true, force: true });
}
finish("persist");
