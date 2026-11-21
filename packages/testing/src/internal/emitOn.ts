import { hosts } from "@keel/runtime-dom/internal";
import { fail } from "./fail.ts";

/**
 * `fire(id, { type: 'emit', detail })` (k.host-element Harness and replay): parses `detail` with the host element's
 * `events` and gives it to `onEvent` as the outside code's `emit` does, returning what `fire` settles after. Throws
 * `schema.invalid`, with nothing called, for an element that is no host element, one without `events`, or a detail
 * that fails it.
 */
export function emitOn(el: Element, id: string, detail: unknown): () => void {
  const entry = hosts.get(el);
  if (entry === undefined)
    throw fail("schema.invalid", `${id} is not a host element: nothing takes an emit`, { at: id });
  const error = entry.emit(detail);
  if (error !== null) throw fail("schema.invalid", `${id}: ${error.message}`, error.data);
  return () => undefined;
}
