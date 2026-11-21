import type { Ctx } from "@keel/ctx";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { ReceiptRow } from "./ReceiptRow.schema.ts";
import { receiptsDb } from "./receiptsDb.server.ts";

/** The receipts book, newest first, each row shaped as a `Receipt`. */
export async function bookOf(ctx: Ctx) {
  const rows = await receiptsDb(ctx).query(
    sql(ReceiptRow)`select id, shop, amount, currency, paid_by as "paidBy", note from receipts order by seq desc`,
  );
  if (!rows.ok) return rows;
  return ok(
    rows.value.map((r) => ({
      id: r.id,
      shop: r.shop,
      total: { amount: r.amount, currency: r.currency },
      paidBy: r.paidBy,
      ...(r.note === null ? {} : { note: r.note }),
    })),
  );
}
