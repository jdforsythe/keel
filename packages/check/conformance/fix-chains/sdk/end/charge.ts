import { sdk } from "./sdk.ts";
import { attempt } from "@keel/schema";
import type { Result } from "@keel/schema";
import { CardDeclined } from "./CardDeclined.schema.ts";
type Charge = { amount: number };
type Receipt = { id: string };
const reasonOf = (x: Error): "funds" | "expired" | "other" =>
  Reflect.get(x, "code") === "insufficient_funds"
    ? "funds"
    : Reflect.get(x, "code") === "expired_card"
      ? "expired"
      : "other";
export const charge = (p: Charge): Promise<Result<Receipt, ReturnType<typeof CardDeclined.make>>> =>
  attempt(
    () => sdk.charges.create(p),
    (x) => (x instanceof Error && x.name === "CardError" ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  );
