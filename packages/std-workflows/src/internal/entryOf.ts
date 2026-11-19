type Row<D> = { readonly state: string; readonly data: D };
type Next<D> = (from: Row<D>, event: string, payload: unknown) => { state: string; data: D };
type Taken<D> = (from: Row<D>, event: string, payload: unknown) => { readonly to?: string } | undefined;

/**
 * A chart's `next` that also tells whether the event enters a state (std.workflows Store): the target the chart takes
 * names a `to`, its own state included, so a step or wait that leads back to its state is entered again. A target with
 * no `to`, or none taken, stays in the entry.
 */
export function entryOf<D>(
  next: Next<D>,
  taken: Taken<D>,
): (from: Row<D>, event: string, payload: unknown) => { state: string; data: D; enters: boolean } {
  return (from, event, payload) => ({
    ...next(from, event, payload),
    enters: taken(from, event, payload)?.to !== undefined,
  });
}
