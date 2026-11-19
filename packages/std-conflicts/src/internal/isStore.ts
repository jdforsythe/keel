import type { Store } from "@keel/store";

/** A store (k.store): an object with a string `id` and `restore`, `snapshot` and `head` functions. */
export function isStore(v: unknown): v is Store<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof Reflect.get(v, "id") === "string" &&
    typeof Reflect.get(v, "restore") === "function" &&
    typeof Reflect.get(v, "snapshot") === "function" &&
    typeof Reflect.get(v, "head") === "function"
  );
}
