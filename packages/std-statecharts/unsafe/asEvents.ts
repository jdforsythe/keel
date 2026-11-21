import type { Transaction } from "@keel/store";
import { unsafe } from "./unsafe.ts";

/** The per-event transactions, typed by each event's payload schema. */
export function asEvents<E, T>(table: Readonly<Record<string, Transaction<T, unknown>>>): E {
  return unsafe(
    "each entry is transaction(store, `<id>.<event>`, events[event], fn), so its payload type is that event's schema's",
    () => table as E,
  );
}
