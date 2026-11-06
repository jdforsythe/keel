// Golden-1 data lives behind the api deployable: create a list, reload, open it, add a todo, reload, toggle, undo.
// Usage: node tooling/smoke/persist.mjs [png]  (SMOKE_URL, default http://localhost:4182/; SMOKE_API_LOG: a file
// holding the api server's stdout, whose POST `req` lines are printed after the steps). Compact output (docs/OUTPUT.md).
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const url = process.env.SMOKE_URL ?? "http://localhost:4182/";
const name = `Persist ${process.pid}`;
const lines = [];
const errors = [];
let failed = 0;
const step = (label, pass, detail = "") => {
  if (!pass) failed++;
  lines.push(`${pass ? "ok" : "fail"} ${label}${detail === "" ? "" : ` ${detail}`}`);
};
const t0 = Date.now();
const b = await chromium.launch();
const p = await b.newPage();
p.on("pageerror", (e) => errors.push(String(e)));
const quiet = () => p.waitForLoadState("networkidle");
const box = () => p.getByRole("checkbox", { name: "Done: Milk" });
const listLink = () => p.getByRole("link", { name, exact: true });
try {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.getByLabel("List name").fill(name);
  await p.click("#todos\\.addList");
  await listLink().waitFor({ timeout: 3000 });
  step("create list", true, JSON.stringify(name));
  await p.reload({ waitUntil: "networkidle" });
  step("list after reload", (await listLink().count()) === 1);
  await listLink().click();
  await p.locator("#todos\\.list\\.title", { hasText: name }).waitFor({ timeout: 3000 });
  const listUrl = new URL(p.url()).pathname;
  step("open list", listUrl.startsWith("/lists/"), listUrl);
  await p.getByLabel("Title").fill("Milk");
  await p.click("#todos\\.addTodo");
  await box().waitFor({ timeout: 3000 });
  step("add todo", true);
  await p.reload({ waitUntil: "networkidle" });
  await box().waitFor({ timeout: 3000 });
  const title = await p.locator("#todos\\.list\\.title").innerText();
  step("todo after reload", title === name && (await box().count()) === 1, new URL(p.url()).pathname);
  await box().click();
  await quiet();
  await p.waitForFunction(() => document.querySelector('input[type="checkbox"]')?.checked === true, null, {
    timeout: 3000,
  });
  step("toggle", await box().isChecked());
  await p.click("#todos\\.undo");
  await quiet();
  await p.waitForFunction(() => document.querySelector('input[type="checkbox"]')?.checked === false, null, {
    timeout: 3000,
  });
  step("undo", !(await box().isChecked()));
  await p.reload({ waitUntil: "networkidle" });
  await box().waitFor({ timeout: 3000 });
  step("undo after reload", !(await box().isChecked()));
  if (process.argv[2] !== undefined) await p.screenshot({ path: process.argv[2], fullPage: true });
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
}
await b.close();
for (const e of errors) step("pageerror", false, e.split("\n")[0]);
for (const l of lines) console.log(l);
if (process.env.SMOKE_API_LOG !== undefined) {
  const log = await readFile(process.env.SMOKE_API_LOG, "utf8");
  for (const l of log.split("\n").filter((x) => /^req POST /.test(x) || /\bPOST\b/.test(x))) console.log(`api ${l}`);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`${failed === 0 ? "ok" : "fail"} persist ${lines.length} steps, ${failed} failed (${secs}s)`);
process.exitCode = failed === 0 ? 0 : 1;
