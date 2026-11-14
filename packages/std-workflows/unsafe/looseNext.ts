import { unsafe } from "./unsafe.ts";

type Next<D> = (from: { state: string; data: D }, event: string, payload: unknown) => { state: string; data: D };

/** A chart's `next` called with an event name from its `events` and that event's parsed payload. */
export function looseNext<D>(next: unknown): Next<D> {
  return unsafe(
    "the event is a key of chart.events and the payload parsed by that event's schema inside s.object({ id, payload })",
    () => next as Next<D>,
  );
}
