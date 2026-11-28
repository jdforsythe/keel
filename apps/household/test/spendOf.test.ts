import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Receipt } from "../modules/receipts/Receipt.schema.ts";
import { spendOf } from "../modules/receipts/spendOf.ts";

/** A receipt as the book holds it, parsed by its schema. */
const receipt = (id: string, amount: number, currency: "EUR" | "JPY", paidBy: "alex" | "sam") => {
  const r = Receipt.parse({ id, shop: "Corner shop", total: { amount, currency }, paidBy });
  if (!r.ok) throw new Error(`receipt ${id} fails its schema`);
  return r.value;
};

it("sums what each member paid, one entry per currency in the order the book first shows it", () => {
  const book = [
    receipt("r1", 1250, "EUR", "alex"),
    receipt("r2", 800, "JPY", "sam"),
    receipt("r3", 400, "EUR", "sam"),
    receipt("r4", 320, "EUR", "alex"),
  ];
  expect(spendOf(book)).toEqual([
    { currency: "EUR", alex: { amount: 1570, currency: "EUR" }, sam: { amount: 400, currency: "EUR" } },
    { currency: "JPY", alex: { amount: 0, currency: "JPY" }, sam: { amount: 800, currency: "JPY" } },
  ]);
  expect(spendOf([])).toEqual([]);
});

it("leaves out a currency whose sum leaves the money bounds", () => {
  const book = [receipt("r1", 1e15, "EUR", "alex"), receipt("r2", 1, "EUR", "alex"), receipt("r3", 5, "JPY", "sam")];
  expect(spendOf(book).map((c) => c.currency)).toEqual(["JPY"]);
});

it("charts every receipt of a currency it keeps: the two members' sums are that currency's total", () => {
  fc.assert(
    fc.property(gen(s.array(Receipt)), (book) => {
      for (const c of spendOf(book)) {
        const total = book.filter((r) => r.total.currency === c.currency).reduce((n, r) => n + r.total.amount, 0);
        expect(c.alex.amount + c.sam.amount).toBe(total);
        expect([c.alex.currency, c.sam.currency]).toEqual([c.currency, c.currency]);
      }
      expect(new Set(spendOf(book).map((c) => c.currency)).size).toBe(spendOf(book).length);
    }),
    { numRuns: 200, seed: 20261125 },
  );
});
