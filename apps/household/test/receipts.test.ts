import { createCtx } from "@keel/ctx";
import { properties, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import BookPage from "../modules/receipts/BookPage.tsx";
import { ReceiptsText } from "../modules/receipts/ReceiptsText.schema.ts";
import { routes } from "../modules/receipts/routes.ts";

const open = (locale: "en-US" | "de-DE", ctx = createCtx({ mode: "sim", seed: 5 })) =>
  renderRoute("receipts.book", { routes, params: { locale }, ctx });

it("starts empty, in English, with a link to the German page", async () => {
  const page = await open("en-US");
  expect(page.find("receipts.heading").text).toBe("Receipts");
  expect(page.find("receipts.count").text).toBe("0 receipts");
  expect(page.find("receipts.switch").text).toBe("Deutsch");
  expect(page.focusOrder()).toEqual([
    "receipts.switch",
    "receipts.new:shop",
    "receipts.new:amount",
    "receipts.new:currency",
    "receipts.new:paidBy",
    "receipts.new:note",
    "receipts.save",
  ]);
  page.dispose();
});

it("refuses an amount with three decimals and saves nothing", async () => {
  const page = await open("en-US");
  await page.fire("receipts.new:shop", { type: "input", value: "Corner shop" });
  await page.fire("receipts.new:amount", { type: "input", value: "12.345" });
  await page.fire("receipts.save", { type: "click" });
  expect(page.find("receipts.new:amount").state).toMatchObject({ invalid: true });
  expect(page.find("receipts.count").text).toBe("0 receipts");
  page.dispose();
});

it("records a receipt and shows it in each locale's money format", async () => {
  const ctx = createCtx({ mode: "sim", seed: 5 });
  const page = await open("en-US", ctx);
  await page.fire("receipts.new:shop", { type: "input", value: "Corner shop" });
  await page.fire("receipts.new:amount", { type: "input", value: "12,50" });
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
  const de = await open("de-DE", ctx);
  expect(de.find("receipts.heading").text).toBe("Belege");
  expect(de.find("receipts.count").text).toBe("1 Beleg");
  expect(de.find(total).text).toBe("12,50 €");
  expect(de.find(total.replace("total", "payer")).text).toBe("Bezahlt von Sam");
  de.dispose();
});

it("loads a complete message set for each locale", async () => {
  expect((await ReceiptsText.load("de-DE")).heading).toBe("Belege");
  expect((await ReceiptsText.load("en-US")).heading).toBe("Receipts");
});

it("renders any book the schemas allow", async () => {
  await properties(BookPage, { runs: 100, seed: 5 });
});
