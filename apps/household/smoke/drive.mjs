// Drives the built app in Chromium: node smoke/drive.mjs <origin>. Prints one line per check.
import { chromium } from "@playwright/test";

const origin = process.argv[2] ?? "http://localhost:5211";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const check = (name, ok, detail = "") => console.log(`${ok ? "ok" : "fail"} ${name}${detail ? ` ${detail}` : ""}`);

await page.goto(`${origin}/`);
check("start title", (await page.title()) === "Household", await page.title());
await page.click("[id='app.start.toList']");
await page.waitForURL(`${origin}/list`);
await page.waitForLoadState("networkidle");
check("list title", (await page.title()) === "Shopping list", await page.title());
await page.click("[id='shopping.staples.trigger']");
await page.click("[id='shopping.staples.item.milk']");
await page.click("[id='shopping.staples.trigger']");
await page.click("[id='shopping.staples.item.milk']");
const row = page.locator("[id^='shopping.name.']").first();
check("menu adds and raises quantity", (await row.textContent()) === "Milk × 2", await row.textContent());
await page.click("[id='shopping.help.button']");
check("disclosure opens", (await page.getAttribute("[id='shopping.help.button']", "aria-expanded")) === "true");
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
