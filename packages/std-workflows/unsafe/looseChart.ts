import { unsafe } from "./unsafe.ts";

type Row<D> = { readonly state: string; readonly data: D };
type Loose<D> = {
  readonly next: (from: Row<D>, event: string, payload: unknown) => { state: string; data: D };
  readonly enabled: (from: Row<D>, event: string, payload: unknown) => boolean;
};

/** A chart's `next` and `enabled`, called with an event name from its `events` and that event's parsed payload. */
export function looseChart<D>(chart: { readonly next: unknown; readonly enabled: unknown }): Loose<D> {
  return unsafe(
    "the event is a key of chart.events and the payload parsed by that event's schema inside s.object({ id, payload })",
    () => ({ next: chart.next, enabled: chart.enabled }) as Loose<D>,
  );
}
