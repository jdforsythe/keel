import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { NewReceipt } from "./NewReceipt.schema.ts";
import { ReceiptsText } from "./ReceiptsText.schema.ts";
import { bookStores } from "./bookStores.ts";
import { minorUnits } from "./minorUnits.ts";
import { receipts } from "./receipts.contract.ts";

export const recordReceipt = action(
  receipts,
  "receipts.book",
  { input: NewReceipt, stores: bookStores },
  async (input, { params, caller, stores }, ctx) => {
    const amount = minorUnits(input.amount, input.currency);
    const text = await ReceiptsText.load(params.locale);
    if (amount === null)
      return err({ code: "keel.fields", message: text.amountFormat, data: { amount: text.amountFormat } });
    if (stores.book.get("receipts").length >= 200)
      return err({ code: "keel.fields", message: text.full, data: { shop: text.full } });
    const receipt = {
      id: ctx.random.id("Receipt"),
      shop: input.shop,
      total: { amount, currency: input.currency },
      paidBy: input.paidBy,
      ...(input.note === undefined ? {} : { note: input.note }),
    };
    const r = tx(stores.record, { receipt }, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
