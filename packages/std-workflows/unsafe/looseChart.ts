import { unsafe } from "./unsafe.ts";

type Row<D> = { readonly state: string; readonly data: D };
type Loose<D> = {
  readonly next: (from: Row<D>, event: string, payload: unknown) => { state: string; data: D };
  readonly taken: (from: Row<D>, event: string, payload: unknown) => { readonly to?: string } | undefined;
};

/** A chart's `next` and `taken`, called with an event name from its `events` and that event's parsed payload. */
export function looseChart<D>(chart: { readonly next: unknown; readonly taken: unknown }): Loose<D> {
  return unsafe(
    "compileStores calls these only from the transaction of event e, a key of chart.events, with a payload e's schema parsed inside s.object({ id, payload })",
    () => ({ next: chart.next, taken: chart.taken }) as Loose<D>,
  );
}
