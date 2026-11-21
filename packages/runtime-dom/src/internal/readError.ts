import type { KeelError } from "@keel/schema";
import { isRecord } from "./isRecord.ts";

/**
 * `#k-state`'s `error` (the served page's failed loader, k.runtime) as the error `resume` reports: only its `code` and
 * a string `data.at` are read, and the message is the code, so no other value of the error reaches an observer.
 * `null` when absent or misshapen.
 */
export function readError(x: unknown): KeelError<string, { readonly at?: string }> | null {
  if (!isRecord(x) || typeof x.code !== "string") return null;
  const at = isRecord(x.data) && typeof x.data.at === "string" ? x.data.at : undefined;
  return { code: x.code, message: x.code, data: at === undefined ? {} : { at } };
}
