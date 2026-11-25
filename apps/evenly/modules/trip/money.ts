import type { Infer } from "@keel/schema";
import { formatMoney } from "@keel/std-money";
import type { Cost } from "./Cost.schema.ts";
import { locale } from "./locale.ts";

/** Writes `amount` of `currency` as a person reads it: `1250` EUR is `€12.50`. */
export default function money(amount: number, currency: Infer<typeof Cost>["currency"]): string {
  return formatMoney({ amount, currency }, locale);
}
