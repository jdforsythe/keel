import type { KeelError } from "@keel/schema";
import type { Currency } from "./Currency.schema.ts";
import type { MoneyError } from "./MoneyError.ts";

/**
 * Why `parseMoney` failed (std.money): text not of the form, too many fraction digits for the currency, or what
 * `addMoney` reports: another currency's mark and an amount outside the bounds.
 */
export type ParseMoneyError =
  | KeelError<"money.unreadable", Record<string, never>>
  | KeelError<"money.tooManyDecimals", { readonly currency: Currency; readonly decimals: number }>
  | MoneyError;
