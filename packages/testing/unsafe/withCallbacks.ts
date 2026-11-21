import { unsafe } from "./unsafe.ts";

/**
 * The parsed props a component takes as its own props type: `schema.parse` keeps the keys the schema does not name
 * (a callback or slot prop, k.component Slot props), so the value `render` holds is already the full props.
 */
export function withCallbacks<P, A extends P>(parsed: P): A {
  return unsafe(
    "parse keeps unnamed keys, so the parsed props already hold the callback props the type adds",
    () => parsed as A,
  );
}
