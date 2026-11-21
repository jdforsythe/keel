import { unsafe } from "./unsafe.ts";

/** The per-event transactions of a workflow store, typed by each chart event's payload schema. */
export function asEvents<E, T>(table: T): E {
  return unsafe(
    "each entry is transaction(store, `<id>.<event>`, s.object({ id, payload: chart.events[event].schema }), fn)",
    () => table as unknown as E,
  );
}
