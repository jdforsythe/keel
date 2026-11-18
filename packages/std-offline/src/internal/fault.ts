import type { KeelError } from "@keel/schema";
import type { Config } from "./Config.ts";

/**
 * Outbox `c`'s `offline.storage` or `offline.owner` error: a fixed message, its id, so no thrown text or other data
 * reaches what a page shows.
 */
export function fault<C extends "offline.storage" | "offline.owner">(
  c: Config,
  code: C,
): KeelError<C, Readonly<Record<string, never>>> {
  return { code, message: c.id, data: {} };
}
