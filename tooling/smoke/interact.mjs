import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(process.env.SMOKE_URL ?? "http://localhost:4180/", { waitUntil: "networkidle" });
await p.fill("#form1\\:name", "Groceries");
await p.click("#todos\\.addList");
await p.waitForTimeout(300);
const after = await p.evaluate(() => document.body.innerText.slice(0, 400));
const links = await p.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")));
const first = links.find((h) => h && h !== "/");
if (first) {
  await p.click(`a[href="${first}"]`);
  await p.waitForTimeout(300);
}
const route = await p.evaluate(() => ({
  url: location.pathname,
  text: document.body.innerText.slice(0, 400),
  main: document.activeElement?.id,
}));
await p.screenshot({ path: process.argv[2], fullPage: true });
console.log(JSON.stringify({ after, links, route, errors }, null, 1));
await b.close();
