import { type Schema, s } from "@keel/schema";
import type { LogEntry } from "../types/LogEntry.ts";
import { baseSchema } from "./baseSchema.ts";
import { keySchema } from "./keySchema.ts";
import { metaSchema } from "./metaSchema.ts";

/**
 * Codec for a store's log: a union on `name` with one variant per transaction, so each payload is
 * checked by its own schema; `meta` is optional JSON, `base` and `key` optional write fields. With no transactions only
 * the empty log decodes (names are never "").
 */
export function logSchema(payloads: ReadonlyMap<string, Schema<unknown>>): Schema<LogEntry[]> {
  const variants = [...payloads].map(([name, payload]) =>
    s.object({
      id: s.int(),
      name: s.literal(name),
      payload,
      at: s.number(),
      meta: metaSchema.optional(),
      base: baseSchema.optional(),
      key: keySchema.optional(),
    }),
  );
  const [first, ...rest] = variants;
  if (first === undefined)
    return s.array(s.object({ id: s.int(), name: s.literal(""), payload: s.object({}), at: s.number() }));
  return s.array(s.union("name", [first, ...rest]));
}
