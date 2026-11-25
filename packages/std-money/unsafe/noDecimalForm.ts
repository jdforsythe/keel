import { unsafe } from "./unsafe.ts";

/** Throws for an `amount` with no exact decimal form: not a safe integer, or past the 1e15 bound (std.money). */
export function noDecimalForm(amount: number): never {
  return unsafe(
    "Money bounds amount to a safe integer within 1e15 at its schema, so an amount past that reaches formatMoney only through code that skipped the codec, a bug in the caller and never an expected failure a Result would carry",
    () => {
      throw new Error(`money amount ${amount} has no decimal form`);
    },
  );
}
