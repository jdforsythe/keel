import { type Result, err, ok } from "@keel/schema";
import { Money } from "./Money.schema.ts";
import type { MoneyError } from "./MoneyError.ts";
import { CurrencyMismatch } from "./internal/CurrencyMismatch.schema.ts";
import { Overflow } from "./internal/Overflow.schema.ts";

/** Sum two amounts of one currency (std.money). Mixed currencies and out-of-bounds sums are `err`, never thrown. */
export function addMoney(a: Money, b: Money): Result<Money, MoneyError> {
  if (a.currency !== b.currency)
    return err(CurrencyMismatch.make({ left: a.currency, right: b.currency }, "cannot add one currency to another"));
  const amount = a.amount + b.amount;
  const sum = Money.parse({ amount, currency: a.currency });
  if (!sum.ok) return err(Overflow.make({ amount }, "sum is outside the amount bounds"));
  return ok(sum.value);
}
