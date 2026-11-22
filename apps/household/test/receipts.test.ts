import { properties, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import BookPage from "../modules/receipts/BookPage.tsx";
import { ReceiptsText } from "../modules/receipts/ReceiptsText.schema.ts";
import { served, webRoutes } from "./serve.ts";

type Member = Awaited<ReturnType<typeof served>>;

/** The receipts book in `locale`, opened by the signed-in member of `at` (a fresh app when left out). */
const open = async (locale: "en-US" | "de-DE", at?: Member) => {
  const { ctx, app } = at ?? (await served(5));
  return renderRoute("receipts.book", { routes: webRoutes, params: { locale }, ctx, app });
};

it("starts empty, in English, with a link to the German page", async () => {
  const page = await open("en-US");
  expect(page.find("receipts.heading").text).toBe("Receipts");
  expect(page.find("receipts.count")).toMatchObject({ role: "status", text: "0 receipts" });
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
  const at = await served(5);
  const page = await open("en-US", at);
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
  const de = await open("de-DE", at);
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

// Each of the 100 runs renders the page and runs axe over it: about 1.1 s on a laptop, past 5 s on a 2-core runner.
// 100 seeded runs are what `probabilistic` takes (k.ledger), so the case declares its time, as profile.test.ts does.
it("renders any book the schemas allow", { timeout: 30_000 }, async () => {
  await properties(BookPage, { runs: 100, seed: 5 });
});
