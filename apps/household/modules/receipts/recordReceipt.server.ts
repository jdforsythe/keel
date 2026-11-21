import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { NewReceipt } from "./NewReceipt.schema.ts";
import { ReceiptCount } from "./ReceiptCount.schema.ts";
import { ReceiptsText } from "./ReceiptsText.schema.ts";
import { minorUnits } from "./minorUnits.ts";
import { receipts } from "./receipts.contract.ts";
import { receiptsDb } from "./receiptsDb.server.ts";

/** The book holds at most this many receipts. */
const FULL = 200;

export const recordReceipt = action(
  receipts,
  "receipts.book",
  { input: NewReceipt },
  async (input, { params }, ctx) => {
    const amount = minorUnits(input.amount, input.currency);
    const text = await ReceiptsText.load(params.locale);
    if (amount === null)
      return err({ code: "keel.fields", message: text.amountFormat, data: { amount: text.amountFormat } });
    const id = ctx.random.id("Receipt");
    const saved = await receiptsDb(ctx).transaction(
      async (t) => {
        const count = await t.one(sql(ReceiptCount)`select count(*)::int as n from receipts`);
        if (!count.ok) return count;
        if (count.value.n >= FULL) return ok(false);
        const added = await t.run(
          sql(NoRows)`insert into receipts (id, shop, amount, currency, paid_by, note)
                      values (${id}, ${input.shop}, ${amount}, ${input.currency}, ${input.paidBy}, ${input.note ?? null})`,
        );
        return added.ok ? ok(true) : added;
      },
      { isolation: "serializable" },
    );
    if (!saved.ok) return err(saved.error);
    return saved.value ? ok(null) : err({ code: "keel.fields", message: text.full, data: { shop: text.full } });
  },
);
