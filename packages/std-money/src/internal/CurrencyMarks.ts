import type { Currency } from "../Currency.schema.ts";

/** What `parseMoney` reads of one locale: its separators and the marks (code and symbols) of each currency. */
export type CurrencyMarks = {
  readonly decimal: string;
  readonly group: string;
  /** Every mark, lower-cased, with its currency, the longest first, so `us$` is read before `$`. */
  readonly marks: readonly { readonly text: string; readonly currency: Currency }[];
};
