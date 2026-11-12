import type { Restorable } from "./Restorable.ts";

const isStore = (v: unknown): v is Restorable =>
  typeof v === "object" &&
  v !== null &&
  typeof Reflect.get(v, "id") === "string" &&
  typeof Reflect.get(v, "restore") === "function" &&
  typeof Reflect.get(v, "head") === "function";

/** The stores among the values of a `stores` factory's instance (its transactions and other values are skipped). */
export function storesIn(value: unknown): Restorable[] {
  return typeof value === "object" && value !== null ? Object.values(value).filter(isStore) : [];
}
