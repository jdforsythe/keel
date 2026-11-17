import type { KeelError } from "@keel/schema";
import type { Config } from "./Config.ts";

/** The `offline.storage` error of outbox `c`: a fixed message, its id, so the thrown text stays out of what a page shows. */
export function storageError(c: Config): KeelError<"offline.storage", Readonly<Record<string, never>>> {
  return { code: "offline.storage", message: c.id, data: {} };
}
