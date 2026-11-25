import { type Result, err, ok } from "@keel/schema";
import { Money } from "./Money.schema.ts";
import type { MoneyError } from "./MoneyError.ts";

/** Sum two amounts of one currency (std.money). Mixed currencies and out-of-bounds sums are `err`, never thrown. */
export function addMoney(a: Money, b: Money): Result<Money, MoneyError> {
  if (a.currency !== b.currency) {
    const data = { left: a.currency, right: b.currency };
    return err({ code: "money.currencyMismatch", message: `cannot add ${b.currency} to ${a.currency}`, data });
  }
  const amount = a.amount + b.amount;
  const sum = Money.parse({ amount, currency: a.currency });
  if (!sum.ok) return err({ code: "money.overflow", message: "sum is outside the amount bounds", data: { amount } });
  return ok(sum.value);
}
