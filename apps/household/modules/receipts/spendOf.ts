import type { Infer } from "@keel/schema";
import { type Currency, type Money, addMoney } from "@keel/std-money";
import type { Receipt } from "./Receipt.schema.ts";

/**
 * What each member paid, one entry per currency in the order the book first shows it. A currency whose sum leaves
 * the money bounds has no entry: the list below the chart still shows every receipt.
 */
export function spendOf(receipts: readonly Infer<typeof Receipt>[]): { currency: Currency; alex: Money; sam: Money }[] {
  const totals = new Map<Currency, { alex: Money; sam: Money } | "over">();
  for (const r of receipts) {
    const zero = { amount: 0, currency: r.total.currency };
    const now = totals.get(r.total.currency) ?? { alex: zero, sam: zero };
    if (now === "over") continue;
    const sum = addMoney(now[r.paidBy], r.total);
    if (!sum.ok) totals.set(r.total.currency, "over");
    else totals.set(r.total.currency, r.paidBy === "alex" ? { ...now, alex: sum.value } : { ...now, sam: sum.value });
  }
  return [...totals].flatMap(([currency, t]) => (t === "over" ? [] : [{ currency, ...t }]));
}
