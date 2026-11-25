import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

export const ReceiptsText = messages(
  AppLocale,
  {
    heading: {},
    count: { n: s.int({ min: 0 }) },
    empty: {},
    paidBy: { who: s.enum(["alex", "sam"]) },
    formHeading: {},
    shop: {},
    amount: {},
    currency: {},
    payer: {},
    alex: {},
    sam: {},
    note: {},
    save: {},
    saving: {},
    amountFormat: {},
    full: {},
    switchTo: {},
    spendLabel: { currency: s.string() },
    spendSummary: { alex: s.string(), sam: s.string() },
    numbers: {},
    paid: {},
  },
  (locale) => import(`./ReceiptsText/${locale}.ts`),
);
