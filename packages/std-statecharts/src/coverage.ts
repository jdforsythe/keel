import type { Coverage } from "./Coverage.type.ts";
import { nameOf } from "./internal/nameOf.ts";

/**
 * Guarded reachability and stuck states of a chart (std.statecharts) from an `explore` result over its transactions
 * (`explore(Object.values(c.events))`, k.model): `unreached` lists the declared states no explored state holds and
 * `dead` the non-final states some `terminal` state holds, in declaration order. Reads the result's data only.
 */
export function coverage<S extends string>(
  c: { readonly states: { readonly [K in S]: { readonly final?: boolean } } },
  result: { readonly states: readonly unknown[]; readonly terminal: readonly unknown[] },
): Coverage<S> {
  const held = new Set(result.states.map(nameOf));
  const stuck = new Set(result.terminal.map(nameOf));
  const unreached: S[] = [];
  const dead: S[] = [];
  for (const name in c.states) {
    if (!held.has(name)) unreached.push(name);
    if (stuck.has(name) && c.states[name].final !== true) dead.push(name);
  }
  return { unreached, dead };
}
