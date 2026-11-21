// Drives the built app in Chromium: node smoke/drive.mjs <origin>. Prints one line per check.
import { chromium } from "@playwright/test";

const origin = process.argv[2] ?? "http://localhost:5211";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
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
await page.goto(`${origin}/receipts`);
await page.waitForLoadState("networkidle");
const before = await page.textContent("[id='receipts.count']");
await page.fill("[id='receipts.new:shop']", "Market");
await page.fill("[id='receipts.new:amount']", "3.5");
await page.click("[id='receipts.save']");
await page.waitForFunction((b) => document.getElementById("receipts.count")?.textContent !== b, before);
const totals = await page.locator("[id^='receipts.total.']").allTextContents();
check("form records a receipt", totals.includes("€3.50"), totals.join(","));
await page.fill("[id='receipts.new:shop']", "Market");
await page.fill("[id='receipts.new:amount']", "3.555");
await page.click("[id='receipts.save']");
await page.waitForLoadState("networkidle");
const refused = await page.evaluate(() => {
  const amount = document.getElementById("receipts.new:amount");
  return { invalid: amount?.getAttribute("aria-invalid"), error: document.getElementById("receipts.new:amount:error")?.textContent };
});
// FINDINGS L3-1: the server's keel.fields answer reaches neither the field nor its error text.
check("form shows the server's amount error", refused.invalid === "true" && refused.error !== "", JSON.stringify(refused));
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
