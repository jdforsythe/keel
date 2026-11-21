// Drives the built app in Chromium: node smoke/drive.mjs <origin>. Prints one line per check; the app starts empty.
import { chromium } from "@playwright/test";

const origin = process.argv[2] ?? "http://localhost:5211";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
const check = (name, ok, detail = "") => console.log(`${ok ? "ok" : "fail"} ${name}${detail ? ` ${detail}` : ""}`);
const byId = (id) => page.locator(`[id='${id}']`);

await page.goto(`${origin}/`);
check("start title", (await page.title()) === "Household", await page.title());
await byId("app.start.toList").click();
await page.waitForLoadState("networkidle");
check("guard sends the list to setup", page.url() === `${origin}/setup?next=%2Flist`, page.url());
await byId("setup.form:name").fill("Elm Street");
await byId("setup.save").click();
await byId("setup.done").waitFor();
check("setup saves the name", true);

await page.goto(`${origin}/list`);
await page.waitForLoadState("networkidle");
check("list title", (await page.title()) === "Shopping list", await page.title());
await byId("shopping.staples.trigger").click();
await byId("shopping.staples.item.milk").click();
const row = page.locator("[id^='shopping.name.']").first();
await row.waitFor();
await byId("shopping.staples.trigger").click();
await byId("shopping.staples.item.milk").click();
await row.filter({ hasText: "× 2" }).waitFor();
check("menu adds through the API and raises quantity", (await row.textContent()) === "Milk × 2", await row.textContent());
await page.reload();
await page.waitForLoadState("networkidle");
check("the list survives a reload", (await page.locator("[id^='shopping.name.']").first().textContent()) === "Milk × 2");
await byId("shopping.help.button").click();
check("disclosure opens", (await byId("shopping.help.button").getAttribute("aria-expanded")) === "true");

await page.goto(`${origin}/receipts`);
await page.waitForLoadState("networkidle");
const before = await byId("receipts.count").textContent();
await byId("receipts.new:shop").fill("Market");
await byId("receipts.new:amount").fill("3.5");
await byId("receipts.save").click();
await page.locator("[id^='receipts.total.']").first().waitFor();
const totals = await page.locator("[id^='receipts.total.']").allTextContents();
check("form records a receipt", totals.includes("€3.50"), `${before} -> ${totals.join(",")}`);
await byId("receipts.new:shop").fill("Market");
await byId("receipts.new:amount").fill("3.555");
await byId("receipts.save").click();
await page.waitForLoadState("networkidle");
const invalid = await byId("receipts.new:amount").getAttribute("aria-invalid");
const error = await byId("receipts.new:amount:error").textContent();
// FINDINGS L3-1: the server's keel.fields answer reaches neither the field nor its error text.
check("form shows the server's amount error", invalid === "true" && error !== "", JSON.stringify({ invalid, error }));
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
