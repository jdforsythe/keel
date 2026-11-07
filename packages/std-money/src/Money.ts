import { s } from "@keel/schema";
import { Currency } from "./Currency.ts";

/**
 * An amount in integer minor units of one currency (std.money); registered as `money.Money`. Bounded at 1e15 so every sum of two amounts is exact. Closed: an undeclared
 * key fails with rule `unknown-key`. Codec, generator and doc derive from this declaration (k.schema).
 */
export const Money = s.object(
  {
    amount: s.int({ min: -1e15, max: 1e15 }),
    currency: Currency,
  },
  { closed: true },
);
export type Money = s.infer<typeof Money>;

s.register("money.Money", Money);
