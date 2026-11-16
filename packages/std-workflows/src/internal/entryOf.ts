import type { StateSpec } from "@keel/std-statecharts";

type Row<D> = { readonly state: string; readonly data: D };
type Next<D> = (from: Row<D>, event: string, payload: unknown) => { state: string; data: D };
type Enabled<D> = (from: Row<D>, event: string, payload: unknown) => boolean;
type States = Readonly<Record<string, StateSpec<string, string, string, string> | undefined>>;

/**
 * A chart's `next` that also tells whether the event enters a state (std.workflows Store): the target the chart takes
 * names a `to`, its own state included, so a step or wait that leads back to its state is entered again. A target with
 * no `to` stays in the entry. With the guards out of reach it reads the taken target from `enabled` (a `do` applied or
 * not) and the order of the targets: the first unguarded one ends the search.
 */
export function entryOf<D>(
  states: States,
  next: Next<D>,
  enabled: Enabled<D>,
): (from: Row<D>, event: string, payload: unknown) => { state: string; data: D; enters: boolean } {
  return (from, event, payload) => {
    const to = next(from, event, payload);
    if (to.state !== from.state) return { ...to, enters: true };
    const did = enabled(from, event, payload);
    const on = states[from.state]?.on?.[event];
    const list = typeof on === "string" || on === undefined || !Array.isArray(on) ? [on] : on;
    let self = false;
    let stay = false;
    for (const t of list) {
      if (t === undefined) continue;
      const target = typeof t === "string" ? { to: t } : t;
      if ((target.to === undefined || target.to === from.state) && (target.do !== undefined) === did) {
        if (target.to === undefined) stay = true;
        else self = true;
      }
      if (target.guard === undefined) return { ...to, enters: self && !stay };
    }
    return { ...to, enters: did && self && !stay };
  };
}
