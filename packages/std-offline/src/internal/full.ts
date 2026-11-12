import type { Config } from "./Config.ts";

/** Whether `entries` pass the outbox's bounds: more than `limit`, or more than `maxBytes` encoded. */
export const full = (c: Config, entries: readonly unknown[]): boolean =>
  entries.length > c.limit || new TextEncoder().encode(JSON.stringify(entries)).length > c.maxBytes;
