import type { KeelError } from "@keel/schema";
import type { Currency } from "./Currency.ts";

/** Why `addMoney` failed (std.money): mixed currencies, or a sum outside the amount bounds (1e15). */
export type MoneyError =
  | KeelError<"money.currencyMismatch", { readonly left: Currency; readonly right: Currency }>
  | KeelError<"money.overflow", { readonly amount: number }>;
