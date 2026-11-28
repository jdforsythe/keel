import { s } from "@keel/schema";
import { Currency } from "../Currency.schema.ts";

/** `money.currencyMismatch` (std.money): two currencies where one was expected. */
export const CurrencyMismatch = s.error("money.currencyMismatch", s.object({ left: Currency, right: Currency }));
