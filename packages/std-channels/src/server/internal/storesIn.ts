import { isStore } from "@keel/store";
import type { Restorable } from "./Restorable.ts";

/** The stores among the values of a `stores` factory's instance (its transactions and other values are skipped). */
export function storesIn(value: unknown): Restorable[] {
  return typeof value === "object" && value !== null ? Object.values(value).filter(isStore) : [];
}
