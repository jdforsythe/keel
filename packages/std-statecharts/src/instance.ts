import type { Schema } from "@keel/schema";
import type { Chart } from "./Chart.type.ts";
import type { ChartInstance } from "./ChartInstance.ts";
import { compileKey } from "./internal/compileKey.ts";

/**
 * Compile `chart` again in the calling scope (std.statecharts): the store `<id>:<key>` with the chart's schema and
 * initial, and per event the transaction `<id>:<key>.<event>` with the chart's function, disposed with the scope.
 * Throws for a key that is not 1 to 64 characters of `[A-Za-z0-9._-]`, and for a live duplicate (k.store).
 */
export function instance<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
>(chart: Chart<D, Ev, S, G, A>, key: string): ChartInstance<D, Ev, S> {
  if (!/^[\w.-]{1,64}$/.test(key)) throw new Error(`instance ${chart.store.id}: key is not [\\w.-]{1,64}`);
  return chart[compileKey](`${chart.store.id}:${key}`);
}
