import type { Currency } from "../Currency.schema.ts";

/** The minor-unit exponent of each supported currency (std.money): JPY 0, the others 2. */
export const EXPONENT: Readonly<Record<Currency, number>> = { EUR: 2, GBP: 2, JPY: 0, USD: 2 };
