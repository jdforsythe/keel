import type { Transaction } from "@keel/store";
import { unsafe } from "./unsafe.ts";

/** The per-event transactions, typed by each event's payload schema. */
export function asEvents<E, T>(table: Readonly<Record<string, Transaction<T, unknown>>>): E {
  return unsafe(
    "chart() and workflow() fill each key with transaction(store, `<id>.<event>`, schema, fn), the schema built from that event's own payload schema, so E holds",
    () => table as E,
  );
}
