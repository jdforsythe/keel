import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(process.env.SMOKE_URL ?? "http://localhost:4180/", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const text = await p.evaluate(() => document.body.innerText.slice(0, 600));
const ids = await p.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id).slice(0, 30));
await p.screenshot({ path: process.argv[2], fullPage: true });
console.log(JSON.stringify({ url: p.url(), text, ids, errors }, null, 1));
await b.close();
