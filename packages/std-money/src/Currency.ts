import { s } from "@keel/schema";

/** ISO 4217 codes `@keel/std-money` supports (std.money); registered as `money.Currency`. */
export const Currency = s.enum(["EUR", "GBP", "JPY", "USD"]);
export type Currency = s.infer<typeof Currency>;

s.register("money.Currency", Currency);
