// Inspector smoke: golden-1 (`keel dev --port 4180`) reports its live graph and
// stores to /__keel/inspect; the inspector (`vite preview --port 4182`) renders them. See README.md for the servers.
import { chromium } from "@playwright/test";

const TARGET = process.env.SMOKE_TARGET ?? "http://localhost:4180";
const INSPECTOR = process.env.SMOKE_INSPECTOR ?? "http://localhost:4182";
const b = await chromium.launch();
const errors = [];
const watch = (p, tag) => {
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(`${tag}: ${m.text()}`);
  });
  p.on("pageerror", (e) => errors.push(`${tag}: ${String(e)}`));
};

// 1. Open golden-1 and run one transaction, so the page has something to report.
const app = await b.newPage();
watch(app, "golden-1");
await app.goto(`${TARGET}/`, { waitUntil: "networkidle" });
await app.fill("#form1\\:name", "Groceries");
await app.click("#todos\\.addList");
await app.waitForTimeout(1500); // the dev entry reports at most once a second

// 2. Open the inspector pointed at golden-1.
const p = await b.newPage();
watch(p, "inspector");
await p.goto(`${INSPECTOR}/?url=${encodeURIComponent(TARGET)}`, { waitUntil: "networkidle" });
await p.waitForSelector("#inspector\\.graph", { timeout: 5000 }).catch(() => {});
const view = await p.evaluate(() => {
  const text = (id) => document.getElementById(id)?.innerText ?? null;
  const items = (id, n) =>
    [...(document.getElementById(id)?.querySelectorAll("li") ?? [])].slice(0, n).map((li) => li.innerText);
  const groups = [...document.querySelectorAll("[id^='inspector.graph.'][id$='.title']")]
    .filter((h) => h.id !== "inspector.graph.title")
    .map((h) => h.innerText);
  return {
    title: text("inspector.title"),
    live: text("inspector.live"),
    routes: text("inspector.routes"),
    graph: { counts: text("inspector.graph.counts"), groups },
    stores: {
      state: text("inspector.store.todos.board.state"),
      count: text("inspector.store.todos.board.count"),
      log: items("inspector.store.todos.board.log", 5),
    },
    ids: { counts: text("inspector.ids.counts"), first: items("inspector.ids.list", 3) },
    error: text("inspector.error.message"),
  };
});
if (process.argv[2]) await p.screenshot({ path: process.argv[2], fullPage: true });
console.log(JSON.stringify({ ...view, errors }, null, 1));
await b.close();
