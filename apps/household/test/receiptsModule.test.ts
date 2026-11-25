// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { NoRows, sql } from "@keel/std-postgres";
import { expect, it } from "vitest";
import { AppLocale } from "../modules/receipts/AppLocale.schema.ts";
import { BookData } from "../modules/receipts/BookData.schema.ts";
import { BookParams } from "../modules/receipts/BookParams.schema.ts";
import { Member } from "../modules/receipts/Member.schema.ts";
import { NewReceipt } from "../modules/receipts/NewReceipt.schema.ts";
import { Receipt } from "../modules/receipts/Receipt.schema.ts";
import { ReceiptCount } from "../modules/receipts/ReceiptCount.schema.ts";
import { ReceiptRow } from "../modules/receipts/ReceiptRow.schema.ts";
import { ReceiptsText } from "../modules/receipts/ReceiptsText.schema.ts";
import de from "../modules/receipts/ReceiptsText/de-DE.ts";
import en from "../modules/receipts/ReceiptsText/en-US.ts";
import { bookOf } from "../modules/receipts/bookOf.server.ts";
import { loadBook } from "../modules/receipts/loadBook.server.ts";
import { receipts } from "../modules/receipts/receipts.contract.ts";
import { receiptsDb } from "../modules/receipts/receiptsDb.server.ts";
import { recordReceipt } from "../modules/receipts/recordReceipt.server.ts";
import { must } from "./must.ts";
import { acceptsGenerated, rejectsAt, survivesJson } from "./schemas.ts";

const book = (locale: "en-US" | "de-DE") => ({
  params: { locale },
  search: {},
  url: `http://localhost/${locale}/receipts`,
  caller: "c",
  user: "u1",
});
const post = (ctx: ReturnType<typeof createCtx>, locale: "en-US" | "de-DE", input: Record<string, unknown>) =>
  recordReceipt.run(
    input,
    { params: { locale }, url: `http://localhost/${locale}/receipts`, caller: "c", user: "u1" },
    ctx,
  );
const sim = (seed: number) => createCtx({ mode: "sim", seed });
const Amounts = s.object({ amount: s.int(), currency: s.string(), paidBy: s.string(), note: s.string().nullable() });

it("knows two locales, a path default, and two members", () => {
  expect(AppLocale.parse("en-US").ok).toBe(true);
  expect(AppLocale.parse("de-DE").ok).toBe(true);
  expect(AppLocale.parse("fr-FR").ok).toBe(false);
  expect(BookParams.parse({ locale: "de-DE" }).ok).toBe(true);
  rejectsAt(BookParams, { locale: "fr-FR" }, "locale");
  expect(Member.parse("alex").ok && Member.parse("sam").ok).toBe(true);
  expect(Member.parse("pat").ok).toBe(false);
  expect(ReceiptCount.parse({ n: 0 }).ok).toBe(true);
  rejectsAt(ReceiptCount, { n: -1 }, "n");
  rejectsAt(ReceiptCount, { n: 1.5 }, "n");
});

it("generates receipts, rows, forms and books that parse and survive the wire", () => {
  for (const schema of [BookParams, Member, NewReceipt, Receipt, ReceiptCount, ReceiptRow, BookData]) {
    acceptsGenerated(schema, 50);
    survivesJson(schema, 50);
  }
});

it("takes a receipt form with a shop line, a typed amount, a currency, a payer and an optional note", () => {
  const form = { shop: "Corner shop", amount: "12.50", currency: "EUR", paidBy: "alex" };
  expect(NewReceipt.parse(form).ok).toBe(true);
  expect(NewReceipt.parse({ ...form, note: "milk\nand eggs" }).ok).toBe(true);
  rejectsAt(NewReceipt, { ...form, shop: "a\nb" }, "shop");
  rejectsAt(NewReceipt, { ...form, shop: "s".repeat(61) }, "shop");
  rejectsAt(NewReceipt, { ...form, amount: "" }, "amount");
  rejectsAt(NewReceipt, { ...form, amount: "1".repeat(17) }, "amount");
  rejectsAt(NewReceipt, { ...form, currency: "XXX" }, "currency");
  rejectsAt(NewReceipt, { ...form, paidBy: "pat" }, "paidBy");
  rejectsAt(NewReceipt, { ...form, note: "n".repeat(501) }, "note");
});

it("takes a stored row with a non-negative amount in minor units and a null or short note", () => {
  const row = {
    id: "2c9a0b5e-5b7e-4d0a-9b57-0a7a1d5b5c11",
    shop: "Shop",
    amount: 1250,
    currency: "EUR",
    paidBy: "sam",
    note: null,
  };
  expect(ReceiptRow.parse(row).ok).toBe(true);
  rejectsAt(ReceiptRow, { ...row, amount: -1 }, "amount");
  rejectsAt(ReceiptRow, { ...row, amount: 12.5 }, "amount");
  rejectsAt(ReceiptRow, { ...row, note: "n".repeat(501) }, "note");
  rejectsAt(ReceiptRow, { ...row, id: "" }, "id");
  expect(Receipt.parse({ id: row.id, shop: "Shop", total: { amount: 1250, currency: "EUR" }, paidBy: "sam" }).ok).toBe(
    true,
  );
  rejectsAt(
    Receipt,
    { id: row.id, shop: "Shop", total: { amount: 1.5, currency: "EUR" }, paidBy: "sam" },
    "total.amount",
  );
});

it("has the same words in both locales, with a count that is none, one or many", async () => {
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  expect((await ReceiptsText.load("en-US")).heading).toBe(en.heading);
  expect((await ReceiptsText.load("de-DE")).heading).toBe(de.heading);
  for (const [locale, text, expected] of [
    ["en-US", en, ["No receipts yet", "1 receipt", "2 receipts", "11 receipts"]],
    ["de-DE", de, ["Noch keine Belege", "1 Beleg", "2 Belege", "11 Belege"]],
  ] as const)
    expect([0, 1, 2, 11].map((n) => formatMessage(text.count, { n }, locale))).toEqual(expected);
  expect(formatMessage(en.paidBy, { who: "sam" }, "en-US")).toBe("Paid by Sam");
  expect(formatMessage(de.paidBy, { who: "alex" }, "de-DE")).toBe("Bezahlt von Alex");
  expect(en.switchTo).not.toBe(de.switchTo);
});

it("puts a German path under its locale and leaves the default locale bare", () => {
  expect(receipts.href("receipts.book", { locale: "de-DE" })).toBe("/de-DE/receipts");
  expect(receipts.href("receipts.book", { locale: "en-US" })).toBe("/receipts");
});

it("reads the book newest first, each receipt shaped with its total and no note key when there is none", async () => {
  const ctx = sim(140);
  expect(await bookOf(ctx)).toEqual({ ok: true, value: [] });
  const one = await post(ctx, "en-US", { shop: "First", amount: "1.00", currency: "EUR", paidBy: "alex" });
  const two = await post(ctx, "en-US", { shop: "Second", amount: "2.50", currency: "USD", paidBy: "sam", note: "tea" });
  expect(one).toEqual({ ok: true, value: null });
  expect(two).toEqual({ ok: true, value: null });
  const read = await bookOf(ctx);
  expect(read.ok && read.value.map((r) => r.shop)).toEqual(["Second", "First"]);
  expect(read.ok && read.value[0]).toMatchObject({
    total: { amount: 250, currency: "USD" },
    paidBy: "sam",
    note: "tea",
  });
  expect(read.ok && "note" in (read.value[1] ?? {})).toBe(false);
  expect(read.ok && read.value.every((r) => Receipt.parse(r).ok)).toBe(true);
});

it("loads the book in the locale of the path, with the words of that locale", async () => {
  const ctx = sim(141);
  must(await post(ctx, "en-US", { shop: "Shop", amount: "3.00", currency: "GBP", paidBy: "alex" }));
  const english = await loadBook.run(book("en-US"), ctx);
  const german = await loadBook.run(book("de-DE"), ctx);
  expect(english).toMatchObject({ ok: true, value: { text: { heading: "Receipts" }, receipts: [{ shop: "Shop" }] } });
  expect(german).toMatchObject({ ok: true, value: { text: { heading: "Belege" }, receipts: [{ shop: "Shop" }] } });
  expect(english.ok && BookData.parse(english.value).ok).toBe(true);
});

it("records a receipt with the amount read in the page's locale, and answers a wrong format with a field error in that locale's words", async () => {
  const ctx = sim(142);
  const base = { shop: "Ecke", currency: "EUR", paidBy: "sam" };
  expect(await post(ctx, "de-DE", { ...base, amount: "12,50 €" })).toEqual({ ok: true, value: null });
  expect(await post(ctx, "en-US", { ...base, amount: "12.50" })).toEqual({ ok: true, value: null });
  const refusedEn = await post(ctx, "en-US", { ...base, amount: "12,50" });
  expect(refusedEn).toMatchObject({ ok: false, error: { code: "keel.fields", data: { amount: en.amountFormat } } });
  const refusedDe = await post(ctx, "de-DE", { ...base, amount: "12,345" });
  expect(refusedDe).toMatchObject({ ok: false, error: { code: "keel.fields", data: { amount: de.amountFormat } } });
  const rows = await receiptsDb(ctx).query(
    sql(Amounts)`select amount, currency, paid_by as "paidBy", note from receipts order by seq`,
  );
  expect(rows).toEqual({
    ok: true,
    value: [
      { amount: 1250, currency: "EUR", paidBy: "sam", note: null },
      { amount: 1250, currency: "EUR", paidBy: "sam", note: null },
    ],
  });
});

it("holds at most 200 receipts and says so on the shop field, in the page's locale, saving nothing more", async () => {
  const ctx = sim(143);
  const filled = await receiptsDb(ctx).run(
    sql(NoRows)`insert into receipts (id, shop, amount, currency, paid_by)
                select 'r' || g, 'Shop', 100, 'EUR', 'alex' from generate_series(1, 200) as g`,
  );
  expect(filled.ok).toBe(true);
  const input = { shop: "One too many", amount: "1.00", currency: "EUR", paidBy: "alex" };
  const german = { ...input, amount: "1,00" };
  expect(await post(ctx, "en-US", input)).toMatchObject({
    ok: false,
    error: { code: "keel.fields", data: { shop: en.full } },
  });
  expect(await post(ctx, "de-DE", german)).toMatchObject({
    ok: false,
    error: { code: "keel.fields", data: { shop: de.full } },
  });
  const count = await receiptsDb(ctx).one(sql(ReceiptCount)`select count(*)::int as n from receipts`);
  expect(count).toEqual({ ok: true, value: { n: 200 } });
  must(await receiptsDb(ctx).run(sql(NoRows)`delete from receipts where id = 'r1'`));
  expect(await post(ctx, "en-US", input)).toEqual({ ok: true, value: null });
});
