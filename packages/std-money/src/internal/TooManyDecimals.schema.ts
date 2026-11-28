import { s } from "@keel/schema";
import { Currency } from "../Currency.schema.ts";

/** `money.tooManyDecimals` (std.money): more fraction digits than the currency's exponent. */
export const TooManyDecimals = s.error("money.tooManyDecimals", s.object({ currency: Currency, decimals: s.int() }));
