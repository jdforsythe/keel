import { properties, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import BookPage from "../modules/receipts/BookPage.tsx";
import { ReceiptsText } from "../modules/receipts/ReceiptsText.schema.ts";
import { served, webRoutes } from "./serve.ts";

type Member = Awaited<ReturnType<typeof served>>;

/** The receipts book in `locale`, opened by the signed-in member of `at` (a fresh app when left out). */
const open = async (locale: "en-US" | "de-DE", at?: Member) => {
  const { ctx, app, user } = at ?? (await served(5));
  return renderRoute("receipts.book", { routes: webRoutes, params: { locale }, ctx, app, user });
};

it("starts empty, in English, with a link to the German page", async () => {
  const page = await open("en-US");
  expect(page.find("receipts.heading").text).toBe("Receipts");
  expect(page.find("receipts.count")).toMatchObject({ role: "status", text: "No receipts yet" });
  expect(page.find("receipts.saving")).toMatchObject({ role: "status", text: "" });
  expect(page.find("receipts.switch").text).toBe("Deutsch");
  expect(page.focusOrder()).toEqual([
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "receipts.switch",
    "receipts.new:shop",
    "receipts.new:amount",
    "receipts.new:currency",
    "receipts.new:paidBy",
    "receipts.new:note",
    "receipts.save",
    "app.recording.note.button",
  ]);
  page.dispose();
});

it("refuses an amount with three decimals and saves nothing", async () => {
  const page = await open("en-US");
  await page.fire("receipts.new:shop", { type: "input", value: "Corner shop" });
  await page.fire("receipts.new:amount", { type: "input", value: "12.345" });
  await page.fire("receipts.save", { type: "click" });
  expect(page.find("receipts.new:amount").state).toMatchObject({ invalid: true });
  expect(page.find("receipts.count").text).toBe("No receipts yet");
  page.dispose();
});

it("reads an amount in the page's locale: 12,50 in German is 12 euros 50, 12,50 in English is refused", async () => {
  const at = await served(5);
  const en = await open("en-US", at);
  await en.fire("receipts.new:shop", { type: "input", value: "Corner shop" });
  await en.fire("receipts.new:amount", { type: "input", value: "12,50" });
  await en.fire("receipts.save", { type: "click" });
  expect(en.find("receipts.new:amount").state).toMatchObject({ invalid: true });
  en.dispose();
  const de = await open("de-DE", at);
  await de.fire("receipts.new:shop", { type: "input", value: "Ecke" });
  await de.fire("receipts.new:amount", { type: "input", value: "12,50 €" });
  await de.fire("receipts.save", { type: "click" });
  expect(de.find("receipts.count").text).toBe("1 Beleg");
  de.dispose();
});

it("records a receipt and shows it in each locale's money format", async () => {
  const at = await served(5);
  const page = await open("en-US", at);
  await page.fire("receipts.new:shop", { type: "input", value: "Corner shop" });
  await page.fire("receipts.new:amount", { type: "input", value: "12.50" });
  await page.fire("receipts.new:paidBy", { type: "input", value: "sam" });
  await page.fire("receipts.save", { type: "click" });
  expect(page.find("receipts.count").text).toBe("1 receipt");
  const [total] = page
    .a11y()
    .flatMap(function ids(n): string[] {
      return [n.id, ...n.children.flatMap(ids)];
    })
    .filter((id) => id.startsWith("receipts.total."));
  expect(total).toBeDefined();
  if (total === undefined) return;
  expect(page.find(total).text).toBe("€12.50");
  page.dispose();
  const de = await open("de-DE", at);
  expect(de.find("receipts.heading").text).toBe("Belege");
  expect(de.find("receipts.count").text).toBe("1 Beleg");
  expect(de.find(total).text).toBe("12,50 €");
  expect(de.find(total.replace("total", "payer")).text).toBe("Bezahlt von Sam");
  de.dispose();
});

it("charts what each member paid, in each currency, with the same numbers as a table", async () => {
  const page = await open("en-US");
  const record = async (shop: string, amount: string, paidBy: "alex" | "sam") => {
    await page.fire("receipts.new:shop", { type: "input", value: shop });
    await page.fire("receipts.new:amount", { type: "input", value: amount });
    await page.fire("receipts.new:paidBy", { type: "input", value: paidBy });
    await page.fire("receipts.save", { type: "click" });
  };
  await record("Corner shop", "12.50", "alex");
  await record("Bakery", "4.00", "sam");
  await record("Market", "3.20", "alex");
  expect(page.find("receipts.count").text).toBe("3 receipts");
  const chart = page.find("receipts.spend.EUR.chart");
  expect(chart).toMatchObject({ role: "img", name: "Paid by each member in EUR" });
  expect(chart.value).toEqual({
    points: [
      { name: "Alex", value: 1570, shown: "€15.70" },
      { name: "Sam", value: 400, shown: "€4.00" },
    ],
  });
  expect(page.find("receipts.spend.EUR.summary").text).toBe("Alex paid €15.70, Sam paid €4.00.");
  await page.fire("receipts.spend.EUR.button", { type: "click" });
  expect(page.find("receipts.spend.EUR.table")).toMatchObject({ role: "table", name: "Paid by each member in EUR" });
  expect(page.find("receipts.spend.EUR.row.0.value").text).toBe("€15.70");
  expect(page.find("receipts.spend.EUR.row.1.name").text).toBe("Sam");
  page.dispose();
});

it("loads a complete message set for each locale", async () => {
  expect((await ReceiptsText.load("de-DE")).heading).toBe("Belege");
  expect((await ReceiptsText.load("en-US")).heading).toBe("Receipts");
});

it("renders any book the schemas allow", async () => {
  await properties(BookPage, { runs: 100, seed: 5 });
});
