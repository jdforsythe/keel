import { kernelSet } from "@keel/schema/internal";
import type { Transaction } from "./types/Transaction.ts";

/** Whether `x` is a transaction `transaction` made in this realm (k.store Guards, k.identity), read from the kernel's record, never from a property. */
export function isTransaction(x: unknown): x is Transaction<unknown, unknown> {
  return typeof x === "object" && x !== null && kernelSet("transaction").has(x);
}
