import type { Transaction } from "@keel/store";
import { isStore } from "./isStore.ts";

/** A transaction (k.store): an object with a string `name`, a `concurrent` policy and the `store` it is bound to. */
export function isTransaction(v: unknown): v is Transaction<unknown, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof Reflect.get(v, "name") === "string" &&
    typeof Reflect.get(v, "concurrent") === "string" &&
    isStore(Reflect.get(v, "store"))
  );
}
